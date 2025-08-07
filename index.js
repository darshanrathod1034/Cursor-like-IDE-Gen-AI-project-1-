import { GoogleGenAI } from "@google/genai";
import readlineSync from 'readline-sync';
import { exec } from 'child_process';
import { promisify } from "util";
import fs from 'fs/promises';
import os from 'os';

const History = [];
const ai = new GoogleGenAI({ apiKey: "AIzaSyATt0F77ieTF_hOq_uicdj8ihyP88BkOK4" }); // Replace with your key
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

// ✅ Register tools
const availableTools = {
    executeCommand,
    writeFile
};

async function runAgent(userProblem) {
    History.push({
        role: 'user',
        parts: [{ text: userProblem }]
    });

    while (true) {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: History,
            config: {
                systemInstruction: `
You are a powerful AI agent that creates full HTML/CSS/JS frontend projects.
You have access to two tools:

1. executeCommand — to create folders or empty files via terminal
2. writeFile — to write HTML, CSS, or JS content into files

Your job:
- Understand user's prompt (e.g., "create calculator website")
- Step-by-step: create folder, create files, then write HTML/CSS/JS into them using writeFile.

Flow:
1. executeCommand: mkdir <project_folder>
2. executeCommand: type nul > <project_folder>/index.html
3. executeCommand: type nul > <project_folder>/style.css
4. executeCommand: type nul > <project_folder>/script.js
5. writeFile: add code into those files
                `,
                tools: [{
                    functionDeclarations: [executeCommandDeclaration, writeFileDeclaration]
                }]
            }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            console.log(response.functionCalls[0]);
            const { name, args } = response.functionCalls[0];
            const funCall = availableTools[name];
            const result = await funCall(args);

            // Add functionCall to history
            History.push({
                role: "model",
                parts: [
                    {
                        functionCall: response.functionCalls[0],
                    },
                ],
            });

            // ✅ Fixed: Add correct functionResponse structure
            History.push({
                role: "user",
                parts: [
                    {
                        functionResponse: {
                            name: name,
                            response: {
                                result: result,
                            },
                        },
                    },
                ],
            });
        } else {
            // Text output
            const text = response.text;
            History.push({
                role: 'model',
                parts: [{ text }]
            });
            console.log(text);
            break;
        }
    }
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
