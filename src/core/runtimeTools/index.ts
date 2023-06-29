import { RuntimeTools } from './types/runtime-tools';
import { NodeRuntimeTools } from './node';

export function getRuntimeTools(runtime: string): RuntimeTools {
  switch (runtime.toUpperCase()) {
    case 'NODE':
      return new NodeRuntimeTools();
    default:
      throw new Error(`Runtime "${runtime}" not understood.`);
  }
}
