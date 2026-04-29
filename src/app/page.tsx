import LandingPage from "./(marketing)/page";

export default function RootPage() {
  /** * We IMPORT the LandingPage directly from your marketing folder.
   * This displays the code without triggering a "307 Redirect" loop.
   */
  return <LandingPage />;
}