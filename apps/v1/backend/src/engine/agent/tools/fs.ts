import { ToolDef } from '../../ai/tools.js';
import z from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const FSTools: ToolDef[] = [
  {
    name: 'list_files',
    description: 'List files in a directory recursively. Respects .gitignore via fd or find if possible, otherwise simple scan.',
    parameters: z.object({
      path: z.string().describe('Relative path to list from root'),
      depth: z.number().optional().describe('Depth to traverse'),
    }),
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file.',
    parameters: z.object({
      path: z.string().describe('Path to the file to read'),
    }),
  },
  {
    name: 'grep_search',
    description: 'Search for a string or pattern in files.',
    parameters: z.object({
      query: z.string().describe('Search query (regex or text)'),
      path: z.string().optional().describe('Path to search in'),
    }),
  },
];

export const FSToolImplementations = {
  list_files: async (args: { path: string; depth?: number }, rootDir: string) => {
    const targetPath = path.resolve(rootDir, args.path || '.');
    // Security check
    if (!targetPath.startsWith(rootDir)) {
      throw new Error('Access denied: Path outside root');
    }
    
    // Quick implementation using fs readdir recursive or find
    try {
        const result = await execAsync(`find "${targetPath}" -maxdepth ${args.depth || 2} -not -path '*/.*'`);
        return result.stdout;
    } catch (e: any) {
        return `Error listing files: ${e.message}`;
    }
  },

  read_file: async (args: { path: string }, rootDir: string) => {
    const targetPath = path.resolve(rootDir, args.path);
    if (!targetPath.startsWith(rootDir)) {
      throw new Error('Access denied: Path outside root');
    }
    try {
        const content = await fs.readFile(targetPath, 'utf-8');
        return content;
    } catch (e: any) {
        return `Error reading file: ${e.message}`;
    }
  },

  grep_search: async (args: { query: string; path?: string }, rootDir: string) => {
    const targetPath = path.resolve(rootDir, args.path || '.');
    if (!targetPath.startsWith(rootDir)) {
      throw new Error('Access denied: Path outside root');
    }
    try {
        // Simple grep
        const command = `grep -r "${args.query}" "${targetPath}" | head -n 20`;
        const result = await execAsync(command);
        return result.stdout || 'No matches found';
    } catch (e: any) {
        // grep returns non-zero if no matches
        return 'No matches found';
    }
  }
};
