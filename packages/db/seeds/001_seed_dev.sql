INSERT INTO users (email, role)
VALUES
  ('admin@ghs.local', 'admin'),
  ('player.one@ghs.local', 'player')
ON CONFLICT (email) DO NOTHING;

INSERT INTO players (user_id, first_name, last_name, email, country, handicap_index)
SELECT u.id, 'Player', 'One', 'player.one@ghs.local', 'GB', 12.4
FROM users u
WHERE u.email = 'player.one@ghs.local'
ON CONFLICT (email) DO NOTHING;
