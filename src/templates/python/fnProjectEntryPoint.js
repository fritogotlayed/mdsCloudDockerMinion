const generateTemplate = (entryPoint) => {
  const parts = entryPoint.split(':');

  return `import fdk
import ${parts[0]} as userModule

def handle(ctx, data=None, loop=None):
    result = userModule.${parts[1]}(input)
    return result or object()

# if __name__ == "__main__":
#     fdk.handler(handle)
`;
};

module.exports = {
  generateTemplate,
};
