export const HELD_OUT_CORPUS_REQUIREMENTS = {
  minHeldOutProjects: 3,
  minHeldOutFirms: 3,
  requiredModes: ["vector", "raster-or-scanned"],
  requiredLabelAuthority: "independent",
};

const VECTOR_MODES = new Set(["vector", "cad-vector"]);
const RASTER_MODES = new Set(["raster", "scanned", "flattened-raster"]);
const PARTITIONS = new Set(["development", "held-out"]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasMode(project, modes) {
  const listed = new Set((project?.drawingModes || []).map((item) => String(item || "").toLowerCase()));
  return [...modes].some((mode) => listed.has(mode));
}

function projectBlockers(project) {
  const blockers = [];
  if (!project?.id) blockers.push("project id is required");
  if (!PARTITIONS.has(project?.partition)) blockers.push("partition must be development or held-out");
  if (!project?.firmId) blockers.push("firmId is required for multi-firm independence");
  if (project?.labelAuthority !== HELD_OUT_CORPUS_REQUIREMENTS.requiredLabelAuthority) blockers.push("labelAuthority must be independent");
  if (project?.bodyLabeled !== true) blockers.push("symbol body bounds must be human-labeled");
  if (!hasMode(project, new Set([...VECTOR_MODES, ...RASTER_MODES]))) blockers.push("drawingModes must include vector, raster, scanned, or flattened-raster");
  if (!Number.isFinite(Number(project?.sheetCount)) || Number(project.sheetCount) <= 0) blockers.push("sheetCount must be positive");
  if (!Number.isFinite(Number(project?.deviceCount)) || Number(project.deviceCount) <= 0) blockers.push("deviceCount must be positive");
  if (!Array.isArray(project?.deviceTypes) || project.deviceTypes.length === 0) blockers.push("deviceTypes must be populated");
  if (!project?.source?.drawingFile) blockers.push("source.drawingFile must point to the real drawing");
  if (!project?.source?.labelFile) blockers.push("source.labelFile must point to the human ground-truth labels");
  return blockers;
}

export function summarizeHeldOutCorpus(manifest = {}) {
  const projects = Array.isArray(manifest.projects) ? manifest.projects : [];
  const projectFindings = projects.map((project) => ({
    id: project?.id || "",
    partition: project?.partition || "",
    firmId: project?.firmId || "",
    blockers: projectBlockers(project),
  }));
  const usableHeldOut = projects.filter((project) => (
    project?.partition === "held-out"
    && projectBlockers(project).length === 0
  ));
  const heldOutFirms = unique(usableHeldOut.map((project) => project.firmId));
  const hasVector = usableHeldOut.some((project) => hasMode(project, VECTOR_MODES));
  const hasRasterOrScanned = usableHeldOut.some((project) => hasMode(project, RASTER_MODES));
  const blockers = [];
  if (!manifest.version) blockers.push("manifest version is required");
  if (usableHeldOut.length < HELD_OUT_CORPUS_REQUIREMENTS.minHeldOutProjects) {
    blockers.push(`at least ${HELD_OUT_CORPUS_REQUIREMENTS.minHeldOutProjects} independently labeled held-out projects are required`);
  }
  if (heldOutFirms.length < HELD_OUT_CORPUS_REQUIREMENTS.minHeldOutFirms) {
    blockers.push(`at least ${HELD_OUT_CORPUS_REQUIREMENTS.minHeldOutFirms} different firms are required in held-out evaluation`);
  }
  if (!hasVector) blockers.push("held-out corpus must include vector PDFs");
  if (!hasRasterOrScanned) blockers.push("held-out corpus must include real raster/scanned or flattened sheets");
  for (const finding of projectFindings) {
    for (const blocker of finding.blockers) {
      blockers.push(`${finding.id || "unnamed project"}: ${blocker}`);
    }
  }
  return {
    ready: blockers.length === 0,
    canClaimProduction99: blockers.length === 0,
    projects: projects.length,
    heldOutProjects: usableHeldOut.length,
    heldOutFirms: heldOutFirms.length,
    hasVector,
    hasRasterOrScanned,
    blockers,
    projectFindings,
  };
}

export function formatHeldOutCorpusStatus(summary) {
  const status = summary?.ready ? "READY" : "BLOCKED";
  const blockers = summary?.blockers?.length
    ? summary.blockers.map((item) => `- ${item}`).join("\n")
    : "- none";
  return [
    `held-out corpus ${status}`,
    `projects ${summary?.projects || 0}`,
    `held-out projects ${summary?.heldOutProjects || 0}`,
    `held-out firms ${summary?.heldOutFirms || 0}`,
    `vector ${summary?.hasVector ? "yes" : "no"}`,
    `raster/scanned ${summary?.hasRasterOrScanned ? "yes" : "no"}`,
    "blockers:",
    blockers,
  ].join("\n");
}
