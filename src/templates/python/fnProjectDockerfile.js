// Taken from: https://github.com/fnproject/tutorials/blob/36562a1960e332da927030cd4f08521e16d3995d/ContainerAsFunction/Dockerfile
const generateTemplate = (
  entryPointFileName = 'func.py',
) => `FROM fnproject/python:dev as build-stage
WORKDIR /function
ADD requirements.txt /function/
RUN pip3 install --target /python/ --no-cache --no-cache-dir --requirement requirements.txt && \
  rm -fr ~/.cache/pip /tmp* requirements.txt Dockerfile .venv
ADD . /function/
RUN rm -fr /function/.pip_cache

FROM fnproject/python

COPY --from=build-stage /function /function
COPY --from=build-stage /python /python
ENV PYTHONPATH=/python
ENTRYPOINT ["/python/bin/fdk", "/function/${entryPointFileName}", "handle"]`;

module.exports = {
  generateTemplate,
};
