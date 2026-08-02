import { CircleAlert } from "lucide-react";

export function ErrorState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="error-state" role="alert">
      <CircleAlert aria-hidden="true" size={20} />
      <div>
        <strong>Data connection interrupted</strong>
        <p>{message}. Check that the backend container is running.</p>
      </div>
    </div>
  );
}
