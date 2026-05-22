INSERT INTO users (email, password_hash, role, is_active)
VALUES
  ('admin@ghs.local', '$2b$10$y7Q3QSwQcQ1kM0IuQ5A5A.iA8e6h8myhN9zj5Qk4qzQyFz7x2CtG6', 'admin', TRUE),
  ('player.one@ghs.local', '$2b$10$u3GQwVg0i3xF0UVt8n.77OFh1J3mR4qMWI6Xybz9TzhB4P4f0zQ5W', 'player', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO players (user_id, first_name, last_name, email, country, handicap_index)
SELECT u.id, 'Player', 'One', 'player.one@ghs.local', 'GB', 12.4
FROM users u
WHERE u.email = 'player.one@ghs.local'
ON CONFLICT (email) DO NOTHING;
