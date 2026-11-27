interface ComingSoonViewProps {
  title: string;
}

// The placeholder for a phase whose view is not built yet (react-web-ui 06–12).
export function ComingSoonView({ title }: ComingSoonViewProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="note">This part of the game is coming soon. Keep this tab open: the screen follows the game by itself.</p>
    </section>
  );
}
