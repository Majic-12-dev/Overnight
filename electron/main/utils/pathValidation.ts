import path from 'node:path'

export function validatePaths(input: string | string[], output: string): void {
  const resolvedOutput = path.resolve(output)
  const inputs = Array.isArray(input) ? input : [input]

  for (const singleInput of inputs) {
    const resolvedInput = path.resolve(singleInput)

    if (resolvedInput === resolvedOutput) {
      throw new Error(`Input path equals output path: ${singleInput}`)
    }

    // Check if output is inside input
    try {
      const rel = path.relative(resolvedInput, resolvedOutput)
      // If rel is non-empty and doesn't start with '..', output is a descendant of input
      if (rel && !rel.startsWith('..')) {
        throw new Error(`Output path is inside input path: ${output} is inside ${singleInput}`)
      }
    } catch (e) {
      // path.relative throws if paths are on different drives (Windows); ignore as they cannot be contained.
    }

    // Check if input is inside output
    try {
      const rel = path.relative(resolvedOutput, resolvedInput)
      if (rel && !rel.startsWith('..')) {
        throw new Error(`Input path is inside output path: ${singleInput} is inside ${output}`)
      }
    } catch (e) {
      // ignore cross-drive errors
    }
  }
}
