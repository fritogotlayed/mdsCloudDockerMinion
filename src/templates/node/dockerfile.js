const generateTemplate = (entryPointFileName = 'func.js') => `FROM node:10-alpine
EXPOSE 50051
WORKDIR /usr/src/app
COPY . .
RUN rm -rf ./node_modules && \
  npm install --only=prod

ENTRYPOINT ["node", "${entryPointFileName}"]`;

module.exports = {
  generateTemplate,
};
