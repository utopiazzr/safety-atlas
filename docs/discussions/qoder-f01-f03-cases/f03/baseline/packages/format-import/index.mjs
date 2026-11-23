import * as prettier from "prettier";

export async function renderImport(job) {
  const project = (await prettier.resolveConfig(job.targetPath, { editorconfig: true })) ?? {};
  const { inferredParser } = await prettier.getFileInfo(job.targetPath);
  const parser = job.parser ?? inferredParser;
  return prettier.format(job.text, {
    ...project,
    filepath: job.targetPath,
    ...(parser ? { parser } : {}),
  });
}
