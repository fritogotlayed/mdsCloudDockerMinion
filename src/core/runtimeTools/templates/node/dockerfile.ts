// TODO: Make node version configurable
export function generateDockerfileBody(entryPointFileName = 'func.js'): string {
  return `FROM node:18-alpine
EXPOSE 50051
WORKDIR /usr/src/app
COPY . .
RUN rm -rf ./node_modules && \
  npm install --only=prod

ENTRYPOINT ["node", "${entryPointFileName}"]`;
}
