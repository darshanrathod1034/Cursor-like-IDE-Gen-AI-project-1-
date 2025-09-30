import 'dotenv/config';
import readlineSync from 'readline-sync';
import { exec } from 'child_process';
import { promisify } from "util";
import fs from 'fs/promises';
import os from 'os';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

const History = [];
const chatHistory = [];
let currentProjectFolder = null;
const system = os.platform();
const execAsync = promisify(exec);

// ✅ TOOL 1: Execute terminal commands
async function executeCommand({ command }) {
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error(`Error executing command: ${stderr}`);
            return `Error: ${stderr}`;
        }
        // Heuristic: capture project folder on mkdir commands
        const mkdirMatch = /(?:^|&&|;|\n)\s*mkdir\s+([\w\-_/\\.]+)/i.exec(command);
        if (mkdirMatch && mkdirMatch[1]) {
            const rawPath = mkdirMatch[1].trim();
            // Normalize backslashes to forward slashes for consistency
            const normalized = rawPath.replace(/\\/g, '/');
            currentProjectFolder = normalized;
        }
        return `Success: ${stdout}`;
    } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        return `Error: ${error.message}`;
    }
}

const executeCommandDeclaration = {
    name: 'executeCommand',
    description: "Execute a terminal command and return the output",
    parameters: {
        type: 'OBJECT',
        properties: {
            command: {
                type: 'STRING',
                description: 'The terminal command to execute'
            },
        },
        required: ['command']
    }
};

// ✅ TOOL 2: Write content to files
async function writeFile({ path, content }) {
    try {
        await fs.writeFile(path, content, 'utf-8');
        // Track current project folder based on common file names
        try {
            const normalized = path.replace(/\\/g, '/');
            const lower = normalized.toLowerCase();
            if (lower.endsWith('/index.html') || lower.endsWith('/style.css') || lower.endsWith('/script.js') || lower.endsWith('/readme.md')) {
                const idx = normalized.lastIndexOf('/');
                if (idx > 0) {
                    currentProjectFolder = normalized.slice(0, idx);
                }
            }
        } catch (_) {}
        return `Successfully wrote to ${path}`;
    } catch (error) {
        return `Error writing to file: ${error.message}`;
    }
}

const writeFileDeclaration = {
    name: 'writeFile',
    description: "Write content to a specified file path",
    parameters: {
        type: 'OBJECT',
        properties: {
            path: {
                type: 'STRING',
                description: 'The full file path to write to'
            },
            content: {
                type: 'STRING',
                description: 'The content to write into the file'
            }
        },
        required: ['path', 'content']
    }
};

// ✅ TOOL 3: Read file content
async function readFileTool({ path }) {
    try {
        const content = await fs.readFile(path, 'utf-8');
        return content;
    } catch (error) {
        return `Error reading file: ${error.message}`;
    }
}

const readFileDeclaration = {
    name: 'readFile',
    description: 'Read and return the contents of a file',
    parameters: {
        type: 'OBJECT',
        properties: {
            path: {
                type: 'STRING',
                description: 'The full file path to read from'
            }
        },
        required: ['path']
    }
};

// ✅ TOOL 4: Update file content (append, replace, insert)
async function updateFile({ path, operation, search, replace, insert, append }) {
    try {
        const original = await fs.readFile(path, 'utf-8').catch(async () => {
            await fs.writeFile(path, '', 'utf-8');
            return '';
        });

        let updated = original;
        switch ((operation || '').toLowerCase()) {
            case 'append': {
                if (typeof append !== 'string') {
                    return 'Error: append text is required for append operation';
                }
                updated = original + append;
                break;
            }
            case 'replace': {
                if (typeof search !== 'string' || typeof replace !== 'string') {
                    return 'Error: search and replace are required for replace operation';
                }
                const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                updated = original.replace(pattern, replace);
                break;
            }
            case 'insertafter': {
                if (typeof search !== 'string' || typeof insert !== 'string') {
                    return 'Error: search and insert are required for insertAfter operation';
                }
                const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                updated = original.replace(pattern, (m) => m + insert);
                break;
            }
            case 'insertbefore': {
                if (typeof search !== 'string' || typeof insert !== 'string') {
                    return 'Error: search and insert are required for insertBefore operation';
                }
                const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                updated = original.replace(pattern, (m) => insert + m);
                break;
            }
            default:
                return 'Error: Unsupported operation. Use append | replace | insertAfter | insertBefore';
        }

        if (updated !== original) {
            await fs.writeFile(path, updated, 'utf-8');
            // Update current project folder if editing a common file
            try {
                const normalized = path.replace(/\\/g, '/');
                const idx = normalized.lastIndexOf('/');
                if (idx > 0) {
                    currentProjectFolder = normalized.slice(0, idx);
                }
            } catch (_) {}
        }
        return `Successfully updated ${path}`;
    } catch (error) {
        return `Error updating file: ${error.message}`;
    }
}

const updateFileDeclaration = {
    name: 'updateFile',
    description: 'Update an existing file by appending, replacing, or inserting content',
    parameters: {
        type: 'OBJECT',
        properties: {
            path: { type: 'STRING', description: 'The full file path to update' },
            operation: { type: 'STRING', description: 'append | replace | insertAfter | insertBefore' },
            search: { type: 'STRING', description: 'Text or pattern to search for (replace/insert)' },
            replace: { type: 'STRING', description: 'Replacement text (replace)' },
            insert: { type: 'STRING', description: 'Text to insert (insertAfter/insertBefore)' },
            append: { type: 'STRING', description: 'Text to append (append)' }
        },
        required: ['path', 'operation']
    }
};

// ✅ Register tools
const availableTools = {
    executeCommand,
    writeFile,
    readFile: readFileTool,
    updateFile
};

// ✅ LangChain tool wrappers using zod schemas
const executeCommandToolLC = new DynamicStructuredTool({
    name: 'executeCommand',
    description: 'Execute a terminal command and return the output',
    schema: z.object({ command: z.string().describe('The terminal command to execute') }),
    func: async ({ command }) => await executeCommand({ command })
});

const writeFileToolLC = new DynamicStructuredTool({
    name: 'writeFile',
    description: 'Write content to a specified file path',
    schema: z.object({
        path: z.string().describe('The full file path to write to'),
        content: z.string().describe('The content to write into the file')
    }),
    func: async ({ path, content }) => await writeFile({ path, content })
});

const readFileToolLC = new DynamicStructuredTool({
    name: 'readFile',
    description: 'Read and return the contents of a file',
    schema: z.object({ path: z.string().describe('The full file path to read from') }),
    func: async ({ path }) => await readFileTool({ path })
});

const updateFileToolLC = new DynamicStructuredTool({
    name: 'updateFile',
    description: 'Update an existing file by appending, replacing, or inserting content',
    schema: z.object({
        path: z.string().describe('The full file path to update'),
        operation: z.enum(['append', 'replace', 'insertAfter', 'insertBefore']).describe('Operation type'),
        search: z.string().optional().describe('Text or pattern to search for'),
        replace: z.string().optional().describe('Replacement text'),
        insert: z.string().optional().describe('Text to insert'),
        append: z.string().optional().describe('Text to append')
    }),
    func: async (args) => await updateFile(args)
});

async function runAgent(userProblem) {
    History.push({
        role: 'user',
        parts: [{ text: userProblem }]
    });

    // Build LangChain agent and execute the request
    const tools = [
        executeCommandToolLC,
        writeFileToolLC,
        updateFileToolLC,
        readFileToolLC,
    ];

    const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: process.env.GOOGLE_API_KEY,
        temperature: 0.3,
        streaming: false
    });

    const systemInstruction = `
You are an AI-powered Code Editor Agent for frontend projects (HTML, CSS, JS) with README.md documentation.
Tools available:
1) executeCommand — run shell commands (mkdir, touch, etc.)
2) writeFile — create or overwrite a file with given content
3) updateFile — update an existing file (append, replace, insert)
4) readFile — read the contents of a file

Workflow Rules (must follow strictly):
1. Understand the user request (e.g., "Add dark mode toggle").
2. Documentation First:
   - Always read README.md. If missing, create it.
   - Update README.md to describe the requested feature and scope.
3. Synchronize All Files:
   - Read index.html, style.css, script.js.
   - Apply updates consistently across HTML/CSS/JS.
   - Ensure no dangling IDs, classes, or functions.
4. Preserve Context:
   - Read before writing. Prefer updateFile for targeted edits.
   - Only use writeFile when creating a new file or full overwrite is intended.
5. Interdependence Rule:
   - Treat HTML, CSS, JS as a linked system. Keep them consistent.
6. Output:
   - When done, provide a short summary of changes in README, HTML, CSS, JS.

Operational Guidance:
- Always create a dedicated project subfolder for each new website or request. Do NOT place new HTML/CSS/JS files at the repo root.
- Name the folder in kebab-case based on the request intent plus a short timestamp for uniqueness, e.g., "to-do-list-website-2025-09-30-1530".
- Create and edit files exclusively inside that folder: <project_folder>/index.html, <project_folder>/style.css, <project_folder>/script.js, and optionally <project_folder>/README.md.
- If the project/folder does not exist, create it using executeCommand (mkdir) and create initial files with writeFile inside the folder.
- Use cross-platform safe edits via updateFile/readFile; avoid OS-specific shell redirections.
- Keep changes minimal and non-breaking; modern, accessible, semantic HTML5; clean CSS; vanilla JS best practices.

Context and Project Selection:
- Maintain and use prior conversation context to interpret follow-up requests (e.g., "add dark mode to it").
- Prefer updating the most recently created project folder if the user refers implicitly ("it", "this site").
- If ambiguity exists between multiple projects, ask a brief disambiguation question before proceeding.

Project Folder Management Rules (enforced):
- Only create a new project folder if the user explicitly asks for a new website/app/project.
- Otherwise, always update files in the most recently active project folder. Assume this is "${currentProjectFolder || '(none)'}".
- If the user mentions "it" or "this site", assume they mean the current project.
- For small feature requests (e.g., "add dark mode", "fix CSS", "update script"), do not create a new folder; open and modify existing files (index.html, style.css, script.js, README.md) in the current project folder.
- If the user asks for a new project while one is active, ask: "Do you want to create a new project or update the existing one?" If they say "switch project", allow changing the current folder.
    `;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemInstruction],
        new MessagesPlaceholder('chat_history'),
        ["human", "{input}"],
        new MessagesPlaceholder('agent_scratchpad')
    ]);

    const agent = await createToolCallingAgent({ llm: model, tools, prompt });
    const executor = new AgentExecutor({ agent, tools });

    // Track conversational context across turns
    chatHistory.push(new HumanMessage(userProblem));
    const result = await executor.invoke({
        input: userProblem,
        chat_history: chatHistory,
        // Expose current project folder as contextual variable the model can reference
        currentProjectFolder: currentProjectFolder
    });
    const text = result?.output ?? '';
    History.push({ role: 'model', parts: [{ text }] });
    chatHistory.push(new AIMessage(text));
            console.log(text);
}

// ✅ Entry point
async function main() {
    console.log("Welcome to the AI Code Editor");
    while (true) {
      //  const userProblem = readlineSync.question("Ask me anything--> ");
      const userProblem = multilineInput();
        if (!userProblem.trim()) {
            console.log("Please enter a valid problem or type 'exit' to quit.");
            continue;
        }
        // Exit condition
        if (userProblem.trim().toLowerCase() === 'exit') break;
        await runAgent(userProblem);
    }
}

function multilineInput(prompt = "Ask me anything (type 'END' to finish):") {
    console.log(prompt);
    let lines = [];
    while (true) {
        const line = readlineSync.question('');
        if (line.trim().toLowerCase() === 'end') break;
        lines.push(line);
    }
    return lines.join(' ');
}


main();
