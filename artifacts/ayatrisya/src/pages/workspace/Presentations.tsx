import { ItemCollection } from '@/components/ItemCollection';
import { slidesToJson } from '@/components/ItemEditors';

const s = (title: string, body: string, layout: 'title' | 'bullets' | 'quote' = 'bullets') => ({ id: crypto.randomUUID(), title, body, layout });
export function PresentationsPage({ notify }: { notify: (m: string) => void }) {
  return <ItemCollection kind="presentation" noun="presentation" eyebrow="Presentations" heading="Plan a story, slide by slide." description="Slide content is stored as JSON in this browser. Export JSON or a text outline. PowerPoint export is not available."
    notify={notify} templates={[
      { name: 'Blank deck', description: 'One empty slide.', content: slidesToJson([s('Title', '', 'title')]) },
      { name: 'Pitch outline', description: 'Problem, approach, ask.', content: slidesToJson([s('Title', 'Subtitle', 'title'), s('The problem', ''), s('Our approach', ''), s('The ask', '')]) },
    ]} />;
}
