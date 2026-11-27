export function App() {
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <div className="eyebrow">Concept-Chain Educational Game Engine</div>
          <h1>
            Diabe-
            <span>teach</span>
          </h1>
          <p>Simple 3-Layer DDD React + Vite Scaffold (domain / api / features)</p>
        </div>
      </header>
      <section className="panel">
        <h2>Ready for Pair Programming</h2>
        <p className="note">
          Folder structure placed under
          {" "}
          <code>web/src/domain</code>
          ,
          {" "}
          <code>web/src/api</code>
          , and
          {" "}
          <code>web/src/features</code>
          .
        </p>
      </section>
    </div>
  );
}
