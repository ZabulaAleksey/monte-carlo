export function LoadingState(): React.JSX.Element {
  return (
    <div className="loading-grid" aria-label="Loading platform data">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}
