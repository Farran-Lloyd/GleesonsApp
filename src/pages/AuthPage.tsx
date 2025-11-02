// src/pages/AuthPage.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Card, Form, Button, Alert } from "react-bootstrap";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || "/";

  const [identifier, setIdentifier] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await signIn(identifier, password);
    setLoading(false);
    if (error) setErr(error.message || "Login failed.");
    else navigate(from, { replace: true });
  }

  return (
    <>
    <div>
        
    </div>
      <Container className="my-5" style={{ maxWidth: 420 }}>
        <Card>
          <Card.Body>
            <h3 className="mb-3 text-center">Log In</h3>
            <Form onSubmit={onLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Username or Email</Form.Label>
                <Form.Control
                  placeholder="e.g. butcher1 or butcher1@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Form.Group>
              {err && <Alert variant="danger">{err}</Alert>}
              <Button type="submit" className="w-100" disabled={loading}>
                {loading ? "Logging in…" : "Log In"}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
}
