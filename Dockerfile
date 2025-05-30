FROM public.ecr.aws/lambda/nodejs:20

ARG NPM_TOKEN

COPY dist ${LAMBDA_TASK_ROOT}/dist
COPY node_modules ${LAMBDA_TASK_ROOT}/node_modules
COPY package*.json ${LAMBDA_TASK_ROOT}


RUN echo "//pkgs.dev.azure.com/pastpostmx/Pastpost/_packaging/pastpostNpm/npm/registry/:_password=" >> .npmrc
RUN echo "//pkgs.dev.azure.com/pastpostmx/Pastpost/_packaging/pastpostNpm/npm/registry/:username=AzureDevOps" >> .npmrc
RUN echo "//pkgs.dev.azure.com/pastpostmx/Pastpost/_packaging/pastpostNpm/npm/registry/:email=tu-email@example.com" >> .npmrc
RUN cat .npmrc 

CMD [ "dist/lambda-entry.handler" ]
