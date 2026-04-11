import type { MarkFlowPlugin } from '@markflow/shared'

const EXTERNAL_LINK_CLASS = 'mf-link-external'
const EXTERNAL_LINK_KIND_ATTR = 'data-mf-link-kind'

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

export function createExternalLinkBadgePlugin(): MarkFlowPlugin {
  return {
    id: 'sample-external-link-badge',
    onload: ({ registerMarkdownPostProcessor }) =>
      registerMarkdownPostProcessor({
        selector: 'a.mf-link[href]',
        process: (element) => {
          if (!(element instanceof HTMLAnchorElement)) {
            return
          }

          if (!isExternalHref(element.href)) {
            return
          }

          if (element.classList.contains(EXTERNAL_LINK_CLASS)) {
            return
          }

          element.classList.add(EXTERNAL_LINK_CLASS)
          element.setAttribute(EXTERNAL_LINK_KIND_ATTR, 'external')

          return () => {
            element.classList.remove(EXTERNAL_LINK_CLASS)
            element.removeAttribute(EXTERNAL_LINK_KIND_ATTR)
          }
        },
      }),
  }
}
