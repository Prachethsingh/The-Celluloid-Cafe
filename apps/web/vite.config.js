import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { frequentlyAskedQuestions, siteDescription } from './src/siteContent.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const site = new URL(environment.VITE_SITE_URL || 'http://localhost:5173/');
  if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw new Error('VITE_SITE_URL must be an absolute HTTP(S) site origin.');
  if (site.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname)) throw new Error('Public VITE_SITE_URL must use HTTPS.');
  const siteUrl = site.href;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': siteUrl + '#app',
        name: 'CinePulse',
        url: siteUrl,
        description: siteDescription,
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'Web browser',
        creator: { '@id': siteUrl + '#organization' },
        author: { '@id': siteUrl + '#organization' },
        datePublished: '2026-10-09T00:00:00Z',
        dateModified: '2026-10-09T00:00:00Z',
      },
      {
        '@type': 'FAQPage',
        '@id': siteUrl + '#faq',
        url: siteUrl,
        mainEntity: frequentlyAskedQuestions.map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      },
      {
        '@type': 'WebSite',
        '@id': siteUrl + '#website',
        name: 'CinePulse',
        url: siteUrl,
        description: siteDescription,
        datePublished: '2026-10-09T00:00:00Z',
        dateModified: '2026-10-09T00:00:00Z',
        publisher: { '@id': siteUrl + '#organization' },
        author: {
          '@type': 'Organization',
          '@id': siteUrl + '#organization',
          name: 'CinePulse Media',
          url: siteUrl,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': siteUrl + '#organization',
        name: 'CinePulse Media',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: new URL('favicon.svg', siteUrl).href,
          width: 512,
          height: 512,
        },
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@cinepulse.app',
            url: siteUrl + '#support',
            availableLanguage: ['en'],
          },
        ],
        sameAs: [
          'https://twitter.com/CinePulseApp',
          'https://github.com/cinepulse',
        ],
      },
    ],
  };
  const metadata = {
    name: 'cinepulse-metadata',
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'description', content: siteDescription }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'author', content: 'CinePulse Editorial Team' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'date', content: '2026-10-09' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'article:published_time', content: '2026-10-09T00:00:00Z' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'article:modified_time', content: '2026-10-09T00:00:00Z' }, injectTo: 'head' },
        ...Object.entries({
          'og:title': 'CinePulse — Movie and Series Discovery',
          'og:description': siteDescription,
          'og:type': 'website',
          'og:url': siteUrl,
          'og:image': new URL('social-card.png', siteUrl).href,
          'og:image:alt': 'CinePulse movie and series discovery',
        }).map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' })),
        ...Object.entries({
          'twitter:card': 'summary_large_image',
          'twitter:title': 'CinePulse — Movie and Series Discovery',
          'twitter:description': siteDescription,
          'twitter:image': new URL('social-card.png', siteUrl).href,
          'twitter:image:alt': 'CinePulse movie and series discovery',
          'twitter:site': '@CinePulseApp',
          'twitter:creator': '@CinePulseApp',
        }).map(([name, content]) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' })),
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(schema).replace(/</g, '\\u003c'), injectTo: 'head' },
      ];
    },
  };
  return {
    plugins: [react(), metadata],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
        '/media': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
  };
});

