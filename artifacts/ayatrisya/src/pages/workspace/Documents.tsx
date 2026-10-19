import { ItemCollection } from '@/components/ItemCollection';

export function DocumentsPage({ id, goto, notify }: { id: string | null; goto: (h: string) => void; notify: (m: string) => void }) {
  return <ItemCollection kind="document" noun="document" eyebrow="Documents" heading="Write, save, reopen." description="Documents are stored in this browser and can be exported as Markdown or plain text. Nothing is uploaded."
    openId={id} onOpen={(x) => goto(x ? `/workspace/documents/${x}` : '/workspace/documents')} notify={notify}
    templates={[
      { name: 'Blank', description: 'An empty page.', content: '' },
      { name: 'Project brief', description: 'Goal, audience, scope, risks.', content: '## Goal\n\n## Audience\n\n## Scope\n\n## Risks and open questions\n\n## Next steps\n' },
      { name: 'Meeting notes', description: 'Attendees, decisions, actions.', content: '## Attendees\n\n## Discussion\n\n## Decisions\n\n## Actions\n- [ ] \n' },
    ]} />;
}
