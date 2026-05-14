export const MAX_LINES_PER_FILE = 1000;
export const MAX_FILES_PER_USER = 20;
export const LIMIT_CONTACT_EMAIL = 'lucian-adrian.gavril@isa.utm.md';

export interface LimitCheck {
  ok: boolean;
  message?: string;
}

export function countLines(source: string): number {
  if (!source) return 1;
  return source.split(/\r\n|\r|\n/).length;
}

export function checkFileLineLimit(source: string): LimitCheck {
  const lineCount = countLines(source);
  if (lineCount <= MAX_LINES_PER_FILE) return { ok: true };
  return {
    ok: false,
    message: `This file has ${lineCount} lines. The demo limit is ${MAX_LINES_PER_FILE} lines per file; contact ${LIMIT_CONTACT_EMAIL} for larger diagrams.`,
  };
}

export function checkUserFileLimit(currentFileCount: number, savingExisting: boolean): LimitCheck {
  if (savingExisting || currentFileCount < MAX_FILES_PER_USER) return { ok: true };
  return {
    ok: false,
    message: `The demo limit is ${MAX_FILES_PER_USER} saved files per user; attempted save would create file ${currentFileCount + 1}. Contact ${LIMIT_CONTACT_EMAIL} for a larger workspace.`,
  };
}
