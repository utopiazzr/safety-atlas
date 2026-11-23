import { join } from "node:path";

export function cases(fixture) {
  const targetPath = join(fixture, "project", "preview.md");
  return [
    {
      label: "JavaScript preview uses destination project's quotes and semicolons",
      job: { originalName: "source/demo.js", targetPath, text: 'const item={label:"east"};' },
      expected: "const item = { label: 'east' }\n",
    },
    {
      label: "TypeScript cell retains its language in a generic cache path",
      job: { originalName: "src/Page.TS", targetPath, text: 'const city:string="east";' },
      expected: "const city: string = 'east'\n",
    },
    {
      label: "JSON cell formats as JSON",
      job: { originalName: "assets/data.json", targetPath, text: '{"active":true,"city":"east"}' },
      expected: '{ "active": true, "city": "east" }\n',
    },
    {
      label: "YAML cell formats as YAML",
      job: { originalName: "config/teams.yml", targetPath, text: 'teams: [east,west]' },
      expected: "teams: [east, west]\n",
    },
    {
      label: "Imported language outside the desktop list retains destination fallback",
      job: { originalName: "notes/README.unknown", targetPath, text: "#  Handoff" },
      expected: "# Handoff\n",
    },
  ];
}
