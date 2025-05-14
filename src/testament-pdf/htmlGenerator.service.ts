import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { translateNationality } from '../common/utils/translation.utils';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class HtmlGeneratorService {
  private template: string | null = null;

  constructor() {
    this.loadTemplateInMemory();
  }

  private async loadTemplateInMemory(): Promise<void> {
    try {
      const templatePath = path.join(
        __dirname,
        'templates',
        'CleanTestamentoHTMLTable.html',
      );
      this.template = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      console.error('Error loading HTML template:', error);
      this.template = '';
    }
  }

  async generateHtml(testamentHeader: any): Promise<string> {
    if (!this.template) {
      return '<h1>Template not loaded</h1>';
    }

    let html = this.template;

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

    // ================== 8) DESIGNACIÓN DE ALBACEA (section3) ==================
    const {
      albaceaName,
      albaceaFather,
      albaceaMother,
      substituteName,
      substituteFather,
      substituteMother,
    } = this.extractExecutorData(testamentHeader.Executor);

    const isAlbaceaEmpty = [
      albaceaName,
      albaceaFather,
      albaceaMother,
      substituteName,
      substituteFather,
      substituteMother,
    ].every((val) => !val || val === 'No data yet');

    if (isAlbaceaEmpty) {
      html = this.removeSectionById(html, 'section3');
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

    // ================== MÚLTIPLES ASIGNACIONES ==================
    if (!['HP', 'HPG'].includes(testamentHeader.inheritanceType)) {
      html = this.removeSectionById(html, 'section4');
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
    const city = addr.city ?? 'No data yet';
    const state = addr.state ?? 'No data yet';
    const zip = addr.zipCode ?? 'No data yet';
    const country = addr.country ?? 'No data yet';

    return `${street}, ${city}, ${state}, ${zip}, ${country}`;
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
        albaceaName: 'No data yet',
        albaceaFather: 'No data yet',
        albaceaMother: 'No data yet',
        substituteName: 'No data yet',
        substituteFather: 'No data yet',
        substituteMother: 'No data yet',
      };
    }

    const executorOne = executors.find((e) => e.priorityOrder === 1);
    const albaceaName = executorOne?.contact?.name ?? 'No data yet';
    const albaceaFather = executorOne?.contact?.fatherLastName ?? 'No data yet';
    const albaceaMother = executorOne?.contact?.motherLastName ?? 'No data yet';

    const executorTwo = executors.find((e) => e.priorityOrder === 2);
    const substituteName = executorTwo?.contact?.name ?? 'No data yet';
    const substituteFather =
      executorTwo?.contact?.fatherLastName ?? 'No data yet';
    const substituteMother =
      executorTwo?.contact?.motherLastName ?? 'No data yet';

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

      return `
      <li>
        <strong>${translatedRelation}</strong>, 
        <strong>${name} ${fatherLastName} ${motherLastName}</strong>,
        con identificación <strong>${idType} ${idNumber}</strong>, quien recibirá
        <strong>${assetPercent} ${assetName}</strong>.
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

    const tutorMainContact = user?.contacts?.find(
      (c: any) => c.id === tutorMainId,
    );
    const tutorSubContact = user?.contacts?.find(
      (c: any) => c.id === tutorSubId,
    );
    const guardianMainContact = user?.contacts?.find(
      (c: any) => c.id === guardianMainId,
    );
    const guardianSubContact = user?.contacts?.find(
      (c: any) => c.id === guardianSubId,
    );

    if (!guardianMainContact) {
      html = this.removeElementById(html, 'guardian-main-text');
    }
    if (!guardianSubContact) {
      html = this.removeElementById(html, 'guardian-sub-text');
    }

    // Tutor principal
    const parentescoTutor1 = this.translateRelationToSpanish(
      tutorMainContact?.relationToUser,
    );
    const nombreTutor1 = tutorMainContact?.name ?? 'No data yet';
    const fatherTutor1 = tutorMainContact?.fatherLastName ?? 'No data yet';
    const motherTutor1 = tutorMainContact?.motherLastName ?? 'No data yet';
    const tipoIdTutor1 = 'CURP';
    const numeroIdTutor1 = tutorMainContact?.governmentId ?? 'No data yet';

    // Tutor suplente
    const parentescoTutor2 = this.translateRelationToSpanish(
      tutorSubContact?.relationToUser,
    );
    const nombreTutor2 = tutorSubContact?.name ?? 'No data yet';
    const fatherTutor2 = tutorSubContact?.fatherLastName ?? 'No data yet';
    const motherTutor2 = tutorSubContact?.motherLastName ?? 'No data yet';
    const tipoIdTutor2 = 'CURP';
    const numeroIdTutor2 = tutorSubContact?.governmentId ?? 'No data yet';

    // Guardian principal
    const nameGuardian1 = guardianMainContact?.name ?? 'No data yet';
    const fatherGuardian1 =
      guardianMainContact?.fatherLastName ?? 'No data yet';
    const motherGuardian1 =
      guardianMainContact?.motherLastName ?? 'No data yet';
    const tipoIdGuardian = 'CURP';
    const numeroIdGuardian1 =
      guardianMainContact?.governmentId ?? 'No data yet';

    // Guardian suplente
    const nameGuardian2 = guardianSubContact?.name ?? 'No data yet';
    const fatherGuardian2 = guardianSubContact?.fatherLastName ?? 'No data yet';
    const motherGuardian2 = guardianSubContact?.motherLastName ?? 'No data yet';
    const numeroIdGuardian2 = guardianSubContact?.governmentId ?? 'No data yet';

    html = html.replace(/{{parentesco_tutor1}}/g, parentescoTutor1);
    html = html.replace(/{{nombre_heredero1_tutor}}/g, nombreTutor1);
    html = html.replace(/{{fatherLastName_heredero1_tutor}}/g, fatherTutor1);
    html = html.replace(/{{motherLastName_heredero1_tutor}}/g, motherTutor1);
    html = html.replace(/{{tipo_identificacion1_tutor}}/g, tipoIdTutor1);
    html = html.replace(/{{numero_identificacion1_tutor}}/g, numeroIdTutor1);

    html = html.replace(/{{parentesco_tutor2}}/g, parentescoTutor2);
    html = html.replace(/{{nombre_heredero2_tutor}}/g, nombreTutor2);
    html = html.replace(/{{fatherLastName_heredero2_tutor}}/g, fatherTutor2);
    html = html.replace(/{{motherLastName_heredero2_tutor}}/g, motherTutor2);
    html = html.replace(/{{tipo_identificacion2_tutor}}/g, tipoIdTutor2);
    html = html.replace(/{{numero_identificacion2_tutor}}/g, numeroIdTutor2);

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
