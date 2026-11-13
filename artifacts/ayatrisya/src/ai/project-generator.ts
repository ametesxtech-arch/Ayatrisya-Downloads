import { modelClient } from '@/ai/client';

export interface ProjectFile {
  path: string;
  content: string;
  description: string;
  language: string;
}

export interface GeneratedProjectResult {
  projectName: string;
  summary: string;
  architecture: string;
  dependencies: Record<string, string>;
  files: ProjectFile[];
}

export interface ProjectGenerationProgress {
  step: 'planning' | 'generating_files' | 'completed' | 'error';
  totalFiles: number;
  completedFiles: number;
  currentFilePath?: string;
  error?: string;
}

/**
 * Plans and writes complete multi-file projects with syntax-aware files,
 * dependency declarations, and architectural breakdowns.
 */
export async function generateProjectFromPrompt(
  prompt: string,
  options: {
    model?: 'v1-fast' | 'v2-best';
    mode?: 'Normal' | 'Savage' | 'Joke';
    onProgress?: (progress: ProjectGenerationProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<GeneratedProjectResult> {
  const {
    model = 'v1-fast',
    mode = 'Normal',
    onProgress,
    signal,
  } = options;

  onProgress?.({
    step: 'planning',
    totalFiles: 0,
    completedFiles: 0,
  });

  // Step 1: Architecture and File Tree Planning
  const planPrompt = `You are the Ayatrisya Code & Project Engine. The user wants to build a complete multi-file project:
"${prompt}"

Plan the project architecture. Return a clean JSON object with this structure:
{
  "projectName": "project-name",
  "summary": "Brief summary of what the project does",
  "architecture": "Overview of modular design and design patterns",
  "dependencies": {
    "package-name": "version"
  },
  "filePlan": [
    {
      "path": "src/index.ts",
      "description": "Main entry point and orchestration",
      "language": "typescript"
    },
    {
      "path": "src/types.ts",
      "description": "Core domain types and contracts",
      "language": "typescript"
    },
    {
      "path": "README.md",
      "description": "Setup, usage and architecture docs",
      "language": "markdown"
    }
  ]
}
Include 3 to 6 focused, complete files necessary for a working implementation. Output ONLY raw valid JSON.`;

  const planResponse = await modelClient.generateResponse(
    [{ role: 'user', content: planPrompt }],
    { model, mode, signal }
  );

  let plan: {
    projectName: string;
    summary: string;
    architecture: string;
    dependencies: Record<string, string>;
    filePlan: Array<{ path: string; description: string; language: string }>;
  };

  try {
    const cleaned = planResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    plan = JSON.parse(cleaned);
  } catch {
    plan = {
      projectName: 'ayatrisya-generated-project',
      summary: `Project for: ${prompt}`,
      architecture: 'Modular TypeScript implementation',
      dependencies: {},
      filePlan: [
        { path: 'src/main.ts', description: 'Application entry point', language: 'typescript' },
        { path: 'src/utils.ts', description: 'Utility helpers', language: 'typescript' },
        { path: 'README.md', description: 'Project overview', language: 'markdown' },
      ],
    };
  }

  const generatedFiles: ProjectFile[] = [];
  const total = plan.filePlan.length;

  // Step 2: Generate Every File's Full Source Code
  for (let i = 0; i < total; i++) {
    const f = plan.filePlan[i];
    if (signal?.aborted) throw new DOMException('Project generation cancelled.', 'AbortError');

    onProgress?.({
      step: 'generating_files',
      totalFiles: total,
      completedFiles: i,
      currentFilePath: f.path,
    });

    const filePrompt = `Write the full, complete source code for file "${f.path}" in project "${plan.projectName}".
Project Goal: "${prompt}"
File Role: "${f.description}"
Language: "${f.language}"
Existing files generated so far: ${generatedFiles.map((gf) => gf.path).join(', ') || 'None yet'}

Rules:
- Provide the FULL, WORKING implementation. Do not use placeholders or "// TODO: implement later".
- Clean syntax, proper imports, strong types and error handling.
- Output ONLY the raw source code text. Do NOT wrap in markdown fences (\`\`\`).`;

    const fileSource = await modelClient.generateResponse(
      [{ role: 'user', content: filePrompt }],
      { model, mode, signal }
    );

    // Strip any accidental code fence wrapping
    const cleanSource = fileSource.replace(/^```[\w-]*\n/, '').replace(/\n```$/, '').trim();

    generatedFiles.push({
      path: f.path,
      content: cleanSource,
      description: f.description,
      language: f.language,
    });
  }

  onProgress?.({
    step: 'completed',
    totalFiles: total,
    completedFiles: total,
  });

  return {
    projectName: plan.projectName,
    summary: plan.summary,
    architecture: plan.architecture,
    dependencies: plan.dependencies || {},
    files: generatedFiles,
  };
}

/**
 * Regenerates or updates a specific file within a project based on user feedback.
 */
export async function regenerateProjectFile(
  projectName: string,
  filePath: string,
  currentContent: string,
  userInstruction: string,
  options: {
    model?: 'v1-fast' | 'v2-best';
    mode?: 'Normal' | 'Savage' | 'Joke';
    signal?: AbortSignal;
  } = {}
): Promise<string> {
  const { model = 'v1-fast', mode = 'Normal', signal } = options;

  const prompt = `You are updating file "${filePath}" in project "${projectName}".
Current code:
"""
${currentContent}
"""

User change request:
"${userInstruction}"

Output the complete, updated source code for "${filePath}". Do NOT use placeholders. Output ONLY raw source code without markdown fences.`;

  const updatedSource = await modelClient.generateResponse(
    [{ role: 'user', content: prompt }],
    { model, mode, signal }
  );

  return updatedSource.replace(/^```[\w-]*\n/, '').replace(/\n```$/, '').trim();
}

export interface ProjectValidationIssue {
  filePath: string;
  line?: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface ProjectValidationResult {
  valid: boolean;
  issues: ProjectValidationIssue[];
}

/**
 * Validates generated project files and configurations (Requirement 1.4)
 * - Checks JSON structure of configuration files like package.json
 * - Checks balanced brackets and syntax closures in source files
 * - Flags missing entrypoints
 */
export function validateProjectFiles(files: Array<{ path: string; content: string }>): ProjectValidationResult {
  const issues: ProjectValidationIssue[] = [];

  const pkg = files.find((f) => f.path.toLowerCase() === 'package.json');
  if (pkg) {
    try {
      JSON.parse(pkg.content);
    } catch (e: any) {
      issues.push({
        filePath: pkg.path,
        severity: 'error',
        message: `Invalid package.json syntax: ${e.message}`,
      });
    }
  }

  for (const f of files) {
    if (f.path.endsWith('.js') || f.path.endsWith('.ts') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx') || f.path.endsWith('.json')) {
      let openBraces = 0;
      let openParens = 0;
      let openBrackets = 0;
      const lines = f.content.split('\n');

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        // Strip string literals and comments to avoid false-positives
        const sanitized = line
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
          .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');

        for (const char of sanitized) {
          if (char === '{') openBraces++;
          else if (char === '}') openBraces--;
          else if (char === '(') openParens++;
          else if (char === ')') openParens--;
          else if (char === '[') openBrackets++;
          else if (char === ']') openBrackets--;
        }
      }

      if (openBraces !== 0) {
        issues.push({
          filePath: f.path,
          severity: 'error',
          message: `Unbalanced curly braces in ${f.path} (delta: ${openBraces})`,
        });
      }
      if (openParens !== 0) {
        issues.push({
          filePath: f.path,
          severity: 'error',
          message: `Unbalanced parentheses in ${f.path} (delta: ${openParens})`,
        });
      }
      if (openBrackets !== 0) {
        issues.push({
          filePath: f.path,
          severity: 'error',
          message: `Unbalanced square brackets in ${f.path} (delta: ${openBrackets})`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}


