import { ItemCollection } from '@/components/ItemCollection';

export function ResearchPage({ notify }: { notify: (m: string) => void }) {
  return <ItemCollection kind="note" tag="research" noun="note" eyebrow="Research notes" heading="Keep sources and questions together." description="Plain notes stored in this browser. There is no automated research or web search in this workspace."
    notify={notify} templates={[
      { name: 'Blank note', description: 'Free-form.', content: '' },
      { name: 'Source log', description: 'Track a source, claims and doubts.', content: 'Source:\nLink:\nKey claims:\n\nWhat I trust:\n\nWhat I doubt:\n' },
      { name: 'Question map', description: 'A question and what you know so far.', content: 'Question:\n\nWhat I know:\n\nWhat I need to find out:\n' },
    ]} />;
}
