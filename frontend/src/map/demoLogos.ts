// Pseudo logos for the fictional demo businesses (names match backend DemoData.java).
// Used only when a business has no logoUrl from the backend. require() gives a bundled asset id.
const DEMO_LOGOS: Record<string, number> = {
  'Bean There Café': require('@/assets/logos/bean-there-cafe.png'),
  'Corner Grocer': require('@/assets/logos/corner-grocer.png'),
  'Page Turner Books': require('@/assets/logos/page-turner-books.png'),
};

export function demoLogoFor(name: string): number | undefined {
  return DEMO_LOGOS[name];
}
