import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, FileText, Search } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { PublicPageFrame } from '@/components/PublicSite';
import { documentationArticles, publicLegalPages, type DocArticle, type PublicLegalPage } from '@/data/public-docs';

const categoryOrder = ['Getting started', 'Products', 'Privacy and storage', 'Security', 'Developer documentation'];

function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    document.title = `${title} · Ayatrisya`;
    if (meta) meta.content = description;
    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [description, title]);
}

function SectionContent({ sections }: { sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.heading} className="scroll-mt-24">
          <h2 className="display text-xl font-semibold tracking-[-.03em] text-slate-100">{section.heading}</h2>
          <div className="mt-3 space-y-3 text-[13px] leading-7 text-slate-400">
            {(section.paragraphs ?? []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets && (
              <ul className="list-disc space-y-2 pl-5 marker:text-violet-300">
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function DocumentationPage() {
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(documentationArticles[0]?.id ?? '');
  const normalizedSearch = search.trim().toLowerCase();
  const visibleArticles = useMemo(() => documentationArticles.filter((article) => {
    if (!normalizedSearch) return true;
    const searchable = `${article.category} ${article.title} ${article.summary} ${article.sections.map((section) => `${section.heading} ${(section.paragraphs ?? []).join(' ')} ${(section.bullets ?? []).join(' ')}`).join(' ')}`;
    return searchable.toLowerCase().includes(normalizedSearch);
  }), [normalizedSearch]);
  const activeArticle = visibleArticles.find((article) => article.id === activeId) ?? visibleArticles[0];

  useEffect(() => {
    if (activeArticle && activeArticle.id !== activeId) setActiveId(activeArticle.id);
  }, [activeArticle, activeId]);
  usePageMetadata('Documentation', 'Ayatrisya setup, product, privacy, model, desktop, and developer documentation.');

  const categories = categoryOrder.map((category) => ({
    name: category,
    articles: visibleArticles.filter((article) => article.category === category),
  })).filter((group) => group.articles.length > 0);

  return (
    <PublicPageFrame eyebrow="Ayatrisya help center" title="Documentation" description="Guides and verified implementation notes for the Ayatrisya workspace. Feature availability depends on the current deployment and connected services.">
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-white/[.07] bg-[#14161c] p-4 lg:sticky lg:top-6" aria-label="Documentation navigation">
          <label htmlFor="docs-search" className="sr-only">Search documentation</label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="docs-search"
              data-testid="input-documentation-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guides"
              className="h-10 w-full rounded-lg border border-white/[.08] bg-[#101116] pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-violet-300/40 focus:outline-none"
            />
          </div>
          <nav className="mt-5 max-h-[55vh] space-y-5 overflow-auto pr-1" aria-label="Articles">
            {categories.map((group) => (
              <div key={group.name}>
                <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-600">{group.name}</p>
                <div className="space-y-1">
                  {group.articles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      data-testid={`button-doc-${article.id}`}
                      aria-current={activeArticle?.id === article.id ? 'page' : undefined}
                      onClick={() => setActiveId(article.id)}
                      className={`flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-[11px] transition ${activeArticle?.id === article.id ? 'bg-violet-300/[.09] text-violet-100' : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-100'}`}
                    >
                      <span>{article.title}</span>
                      {activeArticle?.id === article.id && <ChevronRight size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {visibleArticles.length === 0 && <p className="px-2 py-3 text-xs text-slate-500" role="status">No guides match this search.</p>}
          </nav>
        </aside>
        <article className="min-w-0 rounded-2xl border border-white/[.07] bg-[#14161c] p-5 sm:p-7 lg:p-9" aria-live="polite">
          {activeArticle ? (
            <>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-violet-300">
                <BookOpen size={13} /> {activeArticle.category}
              </div>
              <h2 className="display mt-3 text-2xl font-semibold tracking-[-.045em] text-slate-50 sm:text-3xl">{activeArticle.title}</h2>
              <p className="mt-2 border-b border-white/[.06] pb-5 text-xs leading-6 text-slate-500">{activeArticle.summary}</p>
              <div className="pt-6"><SectionContent sections={activeArticle.sections} /></div>
            </>
          ) : (
            <div className="py-14 text-center">
              <FileText className="mx-auto text-slate-600" size={22} />
              <p className="mt-3 text-sm text-slate-300">No results found</p>
              <p className="mt-1 text-xs text-slate-500">Try a shorter search phrase.</p>
            </div>
          )}
        </article>
      </div>
      <nav aria-label="Legal pages" className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span className="w-full text-[9px] font-semibold uppercase tracking-[.16em] text-slate-600">Policies and notices</span>
        <Link href="/privacy" className="transition hover:text-slate-200">Privacy Policy</Link>
        {publicLegalPages.map((page) => <Link key={page.path} href={page.path} className="transition hover:text-slate-200">{page.title}</Link>)}
      </nav>
    </PublicPageFrame>
  );
}

function LegalPage({ page }: { page: PublicLegalPage }) {
  usePageMetadata(page.title, page.description);
  return (
    <PublicPageFrame eyebrow="Ametesx · Ayatrisya" title={page.title} description={page.description} reviewNotice={!page.reviewed}>
      <SectionContent sections={page.sections} />
    </PublicPageFrame>
  );
}

function UnpublishedPage({
  title,
  description,
  detail,
  effectiveDate,
}: {
  title: string;
  description: string;
  detail: string;
  effectiveDate?: string;
}) {
  usePageMetadata(title, description);
  return (
    <PublicPageFrame eyebrow="Ametesx · Ayatrisya" title={title} description={description}>
      <section
        className="rounded-2xl border border-amber-300/20 bg-amber-300/[.045] p-5 sm:p-7"
        role="status"
        data-testid="legal-page-unpublished"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-200">Not published</p>
        <h2 className="display mt-3 text-xl font-semibold tracking-[-.03em] text-slate-100">{title} is not yet published</h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">{detail}</p>
        {effectiveDate && (
          <p className="mt-4 border-t border-white/[.07] pt-4 text-xs text-slate-300">
            Effective date: <span className="font-medium text-amber-200">{effectiveDate}</span>
          </p>
        )}
      </section>
    </PublicPageFrame>
  );
}

export function PublicDocumentation() {
  return <DocumentationPage />;
}

export function PublicLegalRoute() {
  const [location] = useLocation();
  const routePath = location;
  if (routePath === '/privacy') {
    return (
      <UnpublishedPage
        title="Privacy Policy"
        description="The Ayatrisya Privacy Policy is not yet published."
        detail="This notice is not in effect. The data-flow review, service and retention disclosures, privacy contact, and qualified legal review are still pending."
        effectiveDate="Pending owner and qualified legal approval"
      />
    );
  }
  if (routePath === '/contact') {
    return (
      <UnpublishedPage
        title="Contact"
        description="Contact details for Ayatrisya and Ametesx are not yet published."
        detail="No verified, monitored contact channel is available on this page."
      />
    );
  }
  const page = publicLegalPages.find((item) => item.path === routePath);
  return page ? <LegalPage page={page} /> : <DocumentationPage />;
}

export type { DocArticle };
