FROM public.ecr.aws/lambda/nodejs:20

ARG NPM_TOKEN

COPY dist ${LAMBDA_TASK_ROOT}/dist
COPY node_modules ${LAMBDA_TASK_ROOT}/node_modules
COPY package*.json ${LAMBDA_TASK_ROOT}
COPY .npmrc ${LAMBDA_TASK_ROOT}

RUN echo "//pkgs.dev.azure.com/pastpostmx/_packaging/pastpostmx/npm/registry/:_password=Qmt3N2Y4b2ZPWUJIUWliaFFBdHJidGlXdEdHZ2tmeWNEenNHUkpoS3hWa1ljVmROZk50QUpRUUo5OUJBQUNBQUFBQUFBQUFBQUFBU0FaRE9JbGZr" >> .npmrc && \
    echo "//pkgs.dev.azure.com/pastpostmx/_packaging/pastpostmx/npm/:username=pastpostmx" >> .npmrc && \
    echo "//pkgs.dev.azure.com/pastpostmx/_packaging/pastpostmx/npm/:email=tu-email@example.com" >> .npmrc && \
    cat .npmrc

CMD [ "dist/lambda-entry.handler" ]