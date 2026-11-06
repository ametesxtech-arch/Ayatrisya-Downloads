import { ResponseBlock, UnifiedMessageResponse } from './types';

/**
 * Serializes a unified message response into a canonical Markdown representation
 * that preserves both natural prose and structured blocks.
 */
export function serializeUnifiedResponseToMarkdown(response: UnifiedMessageResponse): string {
  const chunks: string[] = [];

  for (const block of response.blocks) {
    switch (block.type) {
      case 'markdown':
      case 'plain_text':
        if (block.content) chunks.push(block.content);
        break;

      case 'code':
        chunks.push(`\`\`\`${block.language || ''}\n${block.code}\n\`\`\``);
        break;

      case 'math':
        if (block.displayMode) {
          chunks.push(`$$\n${block.expression}\n$$`);
        } else {
          chunks.push(`$${block.expression}$`);
        }
        break;

      case 'table':
        if (block.title) chunks.push(`### ${block.title}\n`);
        if (block.headers.length > 0) {
          chunks.push(`| ${block.headers.join(' | ')} |`);
          chunks.push(`| ${block.headers.map(() => '---').join(' | ')} |`);
          for (const row of block.rows) {
            chunks.push(`| ${row.join(' | ')} |`);
          }
        }
        break;

      case 'citation':
        if (block.sources && block.sources.length > 0) {
          for (let i = 0; i < block.sources.length; i++) {
            const s = block.sources[i];
            chunks.push(`> [^${i + 1}]: [${s.title}](${s.url || '#'})${s.snippet ? ` - "${s.snippet}"` : ''}`);
          }
        }
        break;

      case 'chart':
        chunks.push(`\`\`\`json:chart\n${JSON.stringify(block, null, 2)}\n\`\`\``);
        break;

      case 'flowchart':
      case 'diagram':
        chunks.push(`\`\`\`mermaid\n${block.code}\n\`\`\``);
        break;

      case 'quiz':
        chunks.push(`\`\`\`json:quiz\n${JSON.stringify(block, null, 2)}\n\`\`\``);
        break;

      case 'form':
        chunks.push(`\`\`\`json:form\n${JSON.stringify(block, null, 2)}\n\`\`\``);
        break;

      case 'image':
      case 'media':
        chunks.push(`![${(block as any).alt || (block as any).caption || 'media'}](${block.url || ''})`);
        break;

      case 'tool_call':
        chunks.push(`*Invoking tool:* \`${block.toolCall.toolName}\` (ID: ${block.toolCall.callId})`);
        break;

      case 'tool_result':
        chunks.push(`*Tool \`${block.toolResult.toolName}\` result:* ${block.toolResult.success ? '✅ Success' : '❌ Error'}\n\`\`\`json\n${JSON.stringify(block.toolResult.output, null, 2)}\n\`\`\``);
        break;

      case 'progress':
        chunks.push(`⏳ **${block.label}** (${block.percent != null ? `${block.percent}%` : 'running'})`);
        break;

      case 'error':
        chunks.push(`⚠️ **Error (${block.code || 'UNKNOWN'}):** ${block.message}`);
        break;

      case 'completion':
        chunks.push(`✨ *${block.finishReason ? `Completed (${block.finishReason})` : 'Completed successfully.'}*`);
        break;

      default:
        // Generic fallback for any other block type
        if ('content' in block && typeof (block as any).content === 'string') {
          chunks.push((block as any).content);
        }
        break;
    }
  }

  return chunks.join('\n\n');
}
