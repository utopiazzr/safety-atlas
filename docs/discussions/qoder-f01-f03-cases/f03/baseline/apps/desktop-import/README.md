# Notebook import

Notebook cells enter through `previewCell` in the editor and `convertBatch` in
the background worker. Import handoffs carry the original cell filename
alongside the scratch output path. Language metadata ships with the desktop
app so the settings UI can list supported cell formats without starting a
worker. The formatter service owns the formatting runtime and resolves
project settings against the output path.

From the repository root:

    node --test integration-fixtures/f03-import/quick.test.mjs
    node --test integration-fixtures/f03-import/installed.test.mjs

The quick check runs directly in the development checkout. The installer
check exercises a clean install layout, including the separately installed
publishing client. Dependencies bundled by the formatter service are
available to that service in the install layout.
