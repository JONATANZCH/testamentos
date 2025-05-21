import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { translateNationality } from '../common/utils/translation.utils';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class HtmlGeneratorService {
  private template: string | null = null;
  private templateLoadPromise: Promise<void>;

  constructor() {
    this.templateLoadPromise = this.loadTemplateInMemory();
  }

  private async loadTemplateInMemory(): Promise<void> {
    try {
      const templatePath = path.join(
        __dirname,
        'templates',
        'CleanTestamentoHTMLTable.html',
      );
      console.log(
        `[HtmlGeneratorService] Intentando cargar plantilla desde: ${templatePath}`,
      );
      this.template = await fs.readFile(templatePath, 'utf8');
      console.log(
        `[HtmlGeneratorService] Plantilla cargada correctamente. Longitud: ${this.template.length}. Primeros 100 caracteres: ${this.template.substring(0, 100)}`,
      );
    } catch (error) {
      console.error('Error loading HTML template:', error);
      this.template = '';
    }
  }

  async generateHtml(testamentHeader: any): Promise<string> {
    await this.templateLoadPromise;
    if (!this.template) {
      console.error(
        '[HtmlGeneratorService] generateHtml: La plantilla no está disponible incluso después de esperar. Contenido de this.template:',
        this.template,
      );
      return '<h1>Template not loaded</h1>';
    }

    let html = this.template;
    console.log(
      '[HtmlGeneratorService] generateHtml: Iniciando con plantilla cargada (primeros 100 caracteres):',
      html.substring(0, 100),
    );

    try {
      const logoPath = path.join(__dirname, 'templates', 'logo.png');
      const logoBuffer = await fs.readFile(logoPath);
      const logoBase64 = logoBuffer.toString('base64');
      const logoDataUri = `data:image/png;base64,${logoBase64}`;
      html = html.replace(/{{logo_base64}}/g, logoDataUri);
    } catch (e) {
      console.error('[generateHtml] Failed to embed logo:', e);
    }

    // ================== 1) Header placeholders ==================
    html = html.replace(/{{print_folio}}/g, '000001');

    // ================== 2) Document number y fecha/hora firma ==================
    const documentNumber = this.generateDocumentNumber(testamentHeader);
    const dateAndTimeSignature = this.getNowUTCString();

    html = html.replace(/{{document_number}}/g, documentNumber);
    html = html.replace(/{{date_and_time_SIGNATURE}}/g, dateAndTimeSignature);

    // ================== 3) Datos del usuario ==================
    const user = testamentHeader.user;
    const name = user?.name ?? 'No data yet';
    const fatherLastName = user?.fatherLastName ?? 'No data yet';
    const motherLastName = user?.motherLastName ?? 'No data yet';
    const nationality = translateNationality(user?.nationality);

    html = html.replace(/{{name}}/g, name);
    html = html.replace(/{{fatherLastName}}/g, fatherLastName);
    html = html.replace(/{{motherLastName}}/g, motherLastName);
    html = html.replace(/{{nationality}}/g, nationality);
    const maritalStatus = this.translateMaritalStatus(user?.maritalstatus);
    let maritalRegime = '';
    const spouse = user.contacts?.find(
      (c) => c.relationToUser === 'spouse' && !!c.maritalRegime,
    );
    if (user.maritalstatus?.toLowerCase() === 'married' && spouse) {
      maritalRegime = spouse.maritalRegime;
      html = html.replace(/{{martial_status}}/g, maritalStatus);
      html = html.replace(/{{maritalRegime}}/g, maritalRegime);
    } else {
      html = html.replace(/{{martial_status}}/g, maritalStatus);
      html = html.replace(/ - <strong>\{\{maritalRegime\}\}<\/strong>/g, '');
    }

    // ================== 4) Dirección ==================
    const addressStr = this.formatAddress(user?.addresses);
    html = html.replace(/{{address}}/g, addressStr);

    // ================== 5) Edad ==================
    const age = this.calculateAge(user?.birthDate);
    html = html.replace(/{{age}}/g, age);

    // ================== 6) ID Type & ID Number ==================
    html = html.replace(/{{id_type}}/g, 'CURP');
    const idNumber = user?.governmentId ?? 'No data yet';
    html = html.replace(/{{id_number}}/g, idNumber);

    // === 7) Ocultar / eliminar section3-new si no es HL ===
    if (testamentHeader.inheritanceType !== 'HL') {
      html = this.removeSectionById(html, 'section3-new');
    }

    // ================== MÚLTIPLES ASIGNACIONES ==================
    if (!['HP', 'HPG'].includes(testamentHeader.inheritanceType)) {
      html = this.removeSectionById(html, 'section3');
    } else {
      const assignmentsHtml = this.buildAssignmentsList(
        testamentHeader.TestamentAssignment || [],
        testamentHeader.user,
      );
      html = html.replace(
        /#\{\{designacion_herederos_loop\}\}#/g,
        assignmentsHtml,
      );
    }

    // ================== 8) DESIGNACIÓN DE ALBACEA (section4) ==================
    const {
      albaceaName,
      albaceaFather,
      albaceaMother,
      substituteName,
      substituteFather,
      substituteMother,
    } = this.extractExecutorData(testamentHeader.Executor);

    const isAllEmpty = [
      albaceaName,
      albaceaFather,
      albaceaMother,
      substituteName,
      substituteFather,
      substituteMother,
    ].every((val) => !val || val.trim() === '');
    console.log('[generateHtml] isAlbaceaEmpty for section4:', isAllEmpty);

    if (isAllEmpty) {
      html = this.removeSectionById(html, 'section4');
    } else {
      html = html.replace(/{{albacea_name}}/g, albaceaName);
      html = html.replace(/{{albacea_fatherLastName}}/g, albaceaFather);
      html = html.replace(/{{albacea_motherLastName}}/g, albaceaMother);
      html = html.replace(/{{albacea_subtitue_name}}/g, substituteName);
      html = html.replace(
        /{{albacea_subtitue_fatherLastName}}/g,
        substituteFather,
      );
      html = html.replace(
        /{{albacea_subtitue_motherLastName}}/g,
        substituteMother,
      );
    }

    // ================== LEGADOS ESPECIFICOS ==================
    const legacies = testamentHeader.Legacy || [];
    const legaciesHtml = this.buildLegaciesList(legacies);
    const hasValidLegacies = Array.isArray(legacies) && legacies.length > 0;

    if (
      !hasValidLegacies ||
      legaciesHtml.includes('No hay legados específicos')
    ) {
      html = this.removeSectionById(html, 'section5');
    } else {
      html = html.replace(/#\{\{legados_loop\}\}#/g, legaciesHtml);
    }

    // ================== SECCIÓN 6: Heredero Universal ==================
    if (testamentHeader.inheritanceType !== 'HU') {
      html = this.removeSectionById(html, 'section6');
    } else {
      const {
        universalName,
        universalFather,
        universalMother,
        universalIdType,
        universalIdNumber,
      } = this.extractUniversalHeirData(testamentHeader.universalHeir);

      html = html.replace(/{{universal_heir_name}}/g, universalName);
      html = html.replace(
        /{{universal_heir_fatherLastName}}/g,
        universalFather,
      );
      html = html.replace(
        /{{universal_heir_motherLastName}},/g,
        `${universalMother},`,
      );

      html = html.replace(/{{universal_heir_id_type}}/g, universalIdType);
      html = html.replace(/{{universal_heir_id_number}}/g, universalIdNumber);
    }

    // ================== SECCIÓN 7: Asignaciones digitales ==================
    if (testamentHeader.inheritanceType !== 'HP') {
      html = this.removeSectionById(html, 'section7');
    } else {
      const digitalAssignments =
        testamentHeader.TestamentAssignment?.filter(
          (a) => a.asset?.type === 'digital',
        ) || [];

      if (digitalAssignments.length === 0) {
        html = this.removeSectionById(html, 'section7');
      } else {
        const digitalAssignmentsHtml = this.buildDigitalAssignmentsList(
          digitalAssignments,
          testamentHeader.user,
        );

        html = html.replace(
          /#\{\{designacion_herederos_digital_loop\}\}#/g,
          digitalAssignmentsHtml,
        );
      }
    }

    // ================== SECCIÓN 10: Tutores y Guardianes ==================
    const minorData = testamentHeader.minorSupport;
    if (!minorData) {
      html = this.removeSectionById(html, 'section10');
    } else {
      html = this.fillTutorGuardianSection(
        html,
        minorData,
        testamentHeader.user,
      );
    }

    // ================== SECCIÓN 9-NEW: Ratificación y Validez ==================
    const signatureDateTime = this.getNowUTCString();
    const city = user?.addresses?.[0]?.city ?? 'No data yet';
    const state = user?.addresses?.[0]?.state ?? 'No data yet';
    const signerLocation = `${city}, ${state}`;
    // Datos dummy
    const signatureHash = 'HASHFIRMA1234567890';
    const nftHash = 'NFT1234567890';
    const renatCode = 'RENAT-000001';
    const witnessCode = 'WITNESS-ABC123';
    const nom151Status = 'Adjunta';

    html = html.replace(/\[FECHA Y HORA\]/g, signatureDateTime);
    html = html.replace(/\[CIUDAD Y ESTADO\]/g, signerLocation);
    html = html.replace(/\[HASH DE FIRMA\]/g, signatureHash);
    html = html.replace(/\[HASH NFT\]/g, nftHash);
    html = html.replace(/\[CÓDIGO ÚNICO\]/g, renatCode);
    html = html.replace(/\[CÓDIGO TESTIGO\]/g, witnessCode);
    html = html.replace(/\[ADJUNTA\]/g, nom151Status);

    const uuid = uuidv4();
    html = html.replace(/{{uuid}}/g, uuid);

    return html;
  }

  // ===========================================
  //          MÉTODOS AUXILIARES
  // ===========================================

  private generateDocumentNumber(testamentHeader: any): string {
    const raw = testamentHeader?.documentNumber;
    if (raw === null || raw === undefined) return 'No data yet';

    const padded = raw.toString().padStart(6, '0');
    return `DOC-${padded}`;
  }

  private getNowUTCString(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
  }

  private calculateAge(birthDate?: Date | string): string {
    if (!birthDate) return 'No data yet';
    const dateObj = new Date(birthDate);
    if (isNaN(dateObj.getTime())) return 'No data yet';

    const now = new Date();
    let age = now.getFullYear() - dateObj.getFullYear();
    const m = now.getMonth() - dateObj.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dateObj.getDate())) {
      age--;
    }
    return age.toString();
  }

  private formatAddress(addresses?: any[]): string {
    if (!addresses || addresses.length === 0) {
      return 'No data yet';
    }

    const addr = addresses[0];
    const street = addr.street ?? 'No data yet';
    const suburb = addr.suburb ?? '';
    const city = addr.city ?? 'No data yet';
    const state = addr.state ?? 'No data yet';
    const zip = addr.zipCode ?? 'No data yet';
    const country = addr.country ?? 'No data yet';

    const streetWithSuburb = suburb ? `${street}, ${suburb}` : street;

    return `${streetWithSuburb}, ${city}, ${state}, ${zip}, ${country}`;
  }

  private removeSectionById(html: string, sectionId: string): string {
    const regex = new RegExp(
      `<section id="${sectionId}"[\\s\\S]*?<\\/section>`,
      'g',
    );
    return html.replace(regex, '');
  }

  private removeElementById(html: string, elementId: string): string {
    const regex = new RegExp(
      `<p[^>]*id="${elementId}"[^>]*>[\\s\\S]*?<\\/p>`,
      'g',
    );
    return html.replace(regex, '');
  }

  private extractExecutorData(executors?: any[]) {
    if (!executors || executors.length === 0) {
      return {
        albaceaName: '',
        albaceaFather: '',
        albaceaMother: '',
        substituteName: '',
        substituteFather: '',
        substituteMother: '',
      };
    }

    const executorOne = executors.find((e) => e.priorityOrder === 1);
    const albaceaName = executorOne?.contact?.name ?? '';
    const albaceaFather = executorOne?.contact?.fatherLastName ?? '';
    const albaceaMother = executorOne?.contact?.motherLastName ?? '';

    const executorTwo = executors.find((e) => e.priorityOrder === 2);
    const substituteName = executorTwo?.contact?.name ?? '';
    const substituteFather = executorTwo?.contact?.fatherLastName ?? '';
    const substituteMother = executorTwo?.contact?.motherLastName ?? '';

    return {
      albaceaName,
      albaceaFather,
      albaceaMother,
      substituteName,
      substituteFather,
      substituteMother,
    };
  }

  private buildAssignmentsList(assignments: any[], user: any): string {
    const physicalAssignments = assignments.filter((assignment) => {
      const asset = assignment.asset;
      return (
        asset?.type === 'physical' ||
        (asset?.categoryId === 'ffffffff-ffff-ffff-ffff-ffffffffffff' &&
          asset?.name?.toLowerCase() === 'global')
      );
    });

    if (!physicalAssignments || physicalAssignments.length === 0) {
      return `<li>No hay herederos asignados para activos físicos</li>`;
    }

    const listItems = physicalAssignments.map((assignment) => {
      const {
        name,
        fatherLastName,
        motherLastName,
        relation,
        idType,
        idNumber,
      } = this.extractAssignmentBeneficiary(assignment, user);

      const translatedRelation = this.translateRelationToSpanish(relation);
      const assetName = assignment.asset?.name ?? 'No data yet';
      const assetPercent = assignment.percentage
        ? assignment.percentage.toString() + '%'
        : 'No data yet';

      if (relation === 'Legal Entity') {
        return `
          <li>
            <strong>${name}</strong>, entidad legal registrada con <strong>${idType} ${idNumber}</strong>,
            recibirá el <strong>${assetPercent}</strong> del bien denominado <strong>${assetName}</strong>.
          </li>`;
      }

      const identificationText =
        idNumber && idNumber !== 'No data yet'
          ? ` con <strong>${idType} ${idNumber}</strong>`
          : '';

      return `
        <li>
          <strong>${name} ${fatherLastName} ${motherLastName}</strong>, quien se identifica como
          <strong>${translatedRelation} del testador</strong>${identificationText},
          recibirá el <strong>${assetPercent}</strong> del bien denominado <strong>${assetName}</strong>.
        </li>`;
    });

    return listItems.join('\n');
  }

  private extractAssignmentBeneficiary(assignment: any, user: any) {
    let name = 'No data yet';
    let fatherLastName = '';
    let motherLastName = '';
    let relation = 'No data yet';
    let idType = 'No data yet';
    let idNumber = 'No data yet';

    if (assignment.assignmentType === 'c') {
      const contact = user?.contacts?.find(
        (c: any) => c.id === assignment.assignmentId,
      );
      if (contact) {
        name = contact.name ?? 'No data yet';
        fatherLastName = contact.fatherLastName ?? '';
        motherLastName = contact.motherLastName ?? '';
        relation = contact.relationToUser ?? 'No data yet';
        idType = 'CURP';
        idNumber = contact.governmentId ?? 'No data yet';
      }
    } else if (assignment.assignmentType === 'le') {
      const contactWithLE = user?.contacts?.find(
        (c: any) => c.legalEntityId === assignment.assignmentId,
      );
      if (contactWithLE && contactWithLE.legalEntity) {
        name = contactWithLE.legalEntity?.name ?? 'No data yet';
        relation = 'Legal Entity';
        idType = 'REG';
        idNumber =
          contactWithLE.legalEntity?.registrationNumber ?? 'No data yet';
      } else {
        name = 'Entidad Desconocida';
        relation = 'Legal Entity';
        idType = 'REG';
        idNumber = 'No data yet';
      }
    }

    return {
      name,
      fatherLastName,
      motherLastName,
      relation,
      idType,
      idNumber,
    };
  }

  private buildLegaciesList(legacies: any[]): string {
    if (!legacies || legacies.length === 0) {
      return `<li>No hay legados específicos.</li>`;
    }

    const items = legacies.map((legacy) => {
      const assetNotes = legacy.name ?? 'No data yet';

      const { contact } = legacy;
      let legayName = 'No data yet';
      let legayFatherLastName = '';
      let legayMotherLastName = '';
      const idTypeLegacy = 'CURP';
      let idNumberLegacy = 'No data yet';

      if (contact) {
        legayName = contact.name ?? 'No data yet';
        legayFatherLastName = contact.fatherLastName ?? '';
        legayMotherLastName = contact.motherLastName ?? '';

        idNumberLegacy = contact.governmentId ?? 'No data yet';
        if (contact.legalEntityId && contact.legalEntity) {
          idNumberLegacy =
            contact.legalEntity?.registrationNumber ?? 'No data yet';
        } else {
          idNumberLegacy = contact.governmentId ?? 'No data yet';
        }
      }

      return `
        <li>
          <strong>${assetNotes}</strong> será legado a 
          <strong>${legayName} ${legayFatherLastName} ${legayMotherLastName}</strong>, 
          con identificación <strong>${idTypeLegacy} ${idNumberLegacy}</strong>.
        </li>`;
    });

    return items.join('\n');
  }

  private extractUniversalHeirData(universalHeir: any) {
    if (!universalHeir) {
      return {
        universalName: 'No data yet',
        universalFather: 'No data yet',
        universalMother: 'No data yet',
        universalIdType: 'CURP',
        universalIdNumber: 'No data yet',
      };
    }

    const universalName = universalHeir.name ?? 'No data yet';
    const universalFather = universalHeir.fatherLastName ?? 'No data yet';
    const universalMother = universalHeir.motherLastName ?? 'No data yet';
    const universalIdType = 'CURP';
    const universalIdNumber = universalHeir.governmentId ?? 'No data yet';

    return {
      universalName,
      universalFather,
      universalMother,
      universalIdType,
      universalIdNumber,
    };
  }

  private buildDigitalAssignmentsList(assignments: any[], user: any): string {
    const digitalAssignments = assignments.filter(
      (a) => a.asset?.type === 'digital',
    );

    if (!digitalAssignments || digitalAssignments.length === 0) {
      return `<li>No hay bienes digitales asignados</li>`;
    }

    const listItems = digitalAssignments.map((assignment) => {
      const {
        name,
        fatherLastName,
        motherLastName,
        relation,
        idType,
        idNumber,
      } = this.extractAssignmentBeneficiary(assignment, user);

      const translatedRelation = this.translateRelationToSpanish(relation);

      const assetName = assignment.asset?.name ?? 'No data yet';
      const assetPercent = assignment.percentage
        ? assignment.percentage.toString() + '%'
        : 'No data yet';

      return `
        <li>
          <strong>${translatedRelation}</strong>,
          <strong>${name} ${fatherLastName} ${motherLastName}</strong>,
          con identificación <strong>${idType} ${idNumber}</strong>, 
          quien recibirá <strong>${assetPercent} ${assetName}</strong>.
        </li>
      `;
    });

    return listItems.join('\n');
  }

  private fillTutorGuardianSection(
    html: string,
    minorSupport: any,
    user: any,
  ): string {
    const tutorMainId = minorSupport?.tutor?.main ?? null;
    const tutorSubId = minorSupport?.tutor?.substitute ?? null;
    const guardianMainId = minorSupport?.guardian?.main ?? null;
    const guardianSubId = minorSupport?.guardian?.substitute ?? null;

    const tutorMain = user?.contacts?.find((c: any) => c.id === tutorMainId);
    const tutorSub = user?.contacts?.find((c: any) => c.id === tutorSubId);
    const guardianMain = user?.contacts?.find(
      (c: any) => c.id === guardianMainId,
    );
    const guardianSub = user?.contacts?.find(
      (c: any) => c.id === guardianSubId,
    );

    if (!tutorMain) {
      return this.removeSectionById(html, 'section10');
    }

    const tutorMainRelation = this.translateRelationToSpanish(
      tutorMain?.relationToUser,
    );
    const tutorMainName = [
      tutorMain?.name,
      tutorMain?.fatherLastName,
      tutorMain?.motherLastName,
    ]
      .filter((s) => s && s !== 'No data yet')
      .join(' ');
    const tutorMainIdType = 'CURP';
    const tutorMainIdNumber = tutorMain?.governmentId;
    const tutorMainIdText =
      tutorMainIdNumber && tutorMainIdNumber !== 'No data yet'
        ? `, con identificación <strong>${tutorMainIdType} ${tutorMainIdNumber}</strong>.`
        : '.';

    const tutorMainFinal = `Como tutor principal: <strong>${tutorMainRelation}</strong>, <strong>${tutorMainName}</strong>${tutorMainIdText}`;

    html = html.replace(
      /<li>[\s\S]*?{{parentesco_tutor1}}[\s\S]*?<\/li>/,
      `<li>${tutorMainFinal}</li>`,
    );

    let tutorSubFinal = '';
    if (tutorSub) {
      const tutorSubRelation = this.translateRelationToSpanish(
        tutorSub?.relationToUser,
      );
      const tutorSubName = [
        tutorSub?.name,
        tutorSub?.fatherLastName,
        tutorSub?.motherLastName,
      ]
        .filter((s) => s && s !== 'No data yet')
        .join(' ');
      const tutorSubIdType = 'CURP';
      const tutorSubIdNumber = tutorSub?.governmentId;
      const tutorSubIdText =
        tutorSubIdNumber && tutorSubIdNumber !== 'No data yet'
          ? `, con identificación <strong>${tutorSubIdType} ${tutorSubIdNumber}</strong>.`
          : '.';

      tutorSubFinal = `Tutor suplente: <strong>${tutorSubRelation}</strong>, <strong>${tutorSubName}</strong>${tutorSubIdText}`;

      html = html.replace(
        /<li>[\s\S]*?{{parentesco_tutor2}}[\s\S]*?<\/li>/,
        `<li>${tutorSubFinal}</li>`,
      );
    } else {
      html = html.replace(/<li>\s*Tutor suplente:[\s\S]*?<\/li>/, '');
    }

    if (!guardianMain)
      html = this.removeElementById(html, 'guardian-main-text');
    if (!guardianSub) html = this.removeElementById(html, 'guardian-sub-text');

    const nameGuardian1 = guardianMain?.name ?? '';
    const fatherGuardian1 = guardianMain?.fatherLastName ?? '';
    const motherGuardian1 = guardianMain?.motherLastName ?? '';
    const tipoIdGuardian = 'CURP';
    const numeroIdGuardian1 = guardianMain?.governmentId ?? '';

    const nameGuardian2 = guardianSub?.name ?? '';
    const fatherGuardian2 = guardianSub?.fatherLastName ?? '';
    const motherGuardian2 = guardianSub?.motherLastName ?? '';
    const numeroIdGuardian2 = guardianSub?.governmentId ?? '';

    html = html.replace(/{{name_guardian1}}/g, nameGuardian1);
    html = html.replace(/{{fatherLastName_guardian1}}/g, fatherGuardian1);
    html = html.replace(/{{motherLastName_guardian1}}/g, motherGuardian1);
    html = html.replace(/{{tipo_identificacion_guardian}}/g, tipoIdGuardian);
    html = html.replace(
      /{{numero_identificacion_guardian1}}/g,
      numeroIdGuardian1,
    );

    html = html.replace(/{{name_guardian2}}/g, nameGuardian2);
    html = html.replace(/{{fatherLastName_guardian2}}/g, fatherGuardian2);
    html = html.replace(/{{motherLastName_guardian2}}/g, motherGuardian2);
    html = html.replace(
      /{{numero_identificacion_guardian2}}/g,
      numeroIdGuardian2,
    );

    return html;
  }

  private translateRelationToSpanish(relation: string | undefined): string {
    const relationMap: Record<string, string> = {
      sibling: 'Hermano(a)',
      child: 'Hijo(a)',
      spouse: 'Esposo(a)',
      friend: 'Amigo(a)',
      parent: 'Padre/Madre',
      none: 'Sin relación',
      albacea: 'Albacea',
    };

    if (!relation) return 'No especificado';

    return relationMap[relation.toLowerCase()] || 'Entidad Legal';
  }

  private translateMaritalStatus(status: string | undefined): string {
    const map: Record<string, string> = {
      single: 'Soltero(a)',
      married: 'Casado(a)',
      divorced: 'Divorciado(a)',
      widowed: 'Viudo(a)',
      concubinage: 'Unión libre',
    };

    if (!status) return 'No especificado';
    return map[status.toLowerCase()] ?? 'No especificado';
  }
}
