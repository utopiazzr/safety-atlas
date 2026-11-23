# Import formatter

`renderImport(job)` returns formatted text. The job has `text`, `targetPath`,
and optionally `originalName` and `parser`. If no parser is specified, it is
inferred from the target path. Release clients depend on this default to
format according to the public artifact's filename. Project configuration
and EditorConfig resolve against the target path regardless of the parser.
