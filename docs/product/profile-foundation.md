# Renanime 2.0 — Profile foundation

## Product direction
Profiles are the user's identity inside Renanime, not a static account settings page.

Each profile has two independent image assets:
- `cover_url`: large cover image with a dark lower gradient in the profile UI.
- `avatar_url`: independent avatar used beside the user's name and throughout community surfaces.

## Public identity fields
- `name`, `aka`: display name and unique handle.
- `bio`: short biography (maximum 280 characters).
- `location`: optional location (maximum 80 characters).
- `interests`: editable list of anime genres/interests.
- `favorite_anime_id`: optional AniList/Jikan-compatible anime reference.
- `is_private`: profile visibility preference.

## Media storage
Supabase Storage bucket: `profile-media`.
- Public reads are allowed because profile images are public-facing assets.
- Authenticated writes are restricted to the user's own UUID folder.
- Maximum file size: 5 MiB.
- Accepted formats: JPEG, PNG, WebP and AVIF.
- Suggested object paths: `<auth.uid()>/avatar/<uuid>.<ext>` and `<auth.uid()>/cover/<uuid>.<ext>`.

## Security boundaries
- Profile table contains public identity fields only; never add email, auth tokens or private account data here.
- RLS allows anonymous/authenticated reads only for public profiles, plus owners reading private profiles.
- Owner update permissions remain constrained by the existing profile update policy and column grants.
- Production is not part of this migration. Apply and validate Development first.

## Next implementation slices
1. Profile page visual system: cover, gradient, avatar, identity and real library statistics.
2. Profile editing UI and authenticated media upload flow.
3. Public profile route by AKA, privacy behavior and metadata.
4. Follow graph, activity feed and social counts after product rules are agreed.
