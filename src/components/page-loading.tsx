export default function PageLoading() {
  return (
    <div className="cinema-loading" role="status" aria-label="Loading FairTix">
      <span className="cinema-kicker">FAIRTIX</span>
      <div className="loading-title" />
      <div className="loading-line" />
      <div className="loading-posters">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} />
        ))}
      </div>
      <span>Loading…</span>
    </div>
  );
}
