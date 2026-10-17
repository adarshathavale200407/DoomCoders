import { Card } from "../components/ui.jsx";

/** Temporary placeholder; each route gets replaced in a later step. */
export default function ComingSoon({ title, step }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">This page is built in step {step}.</p>
    </Card>
  );
}
