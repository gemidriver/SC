export const DEFAULT_AVATAR_KEY = 'captain';

export const AVATAR_OPTIONS = [
  {
    key: 'captain',
    label: 'Captain',
    mark: 'CP',
    background: 'linear-gradient(135deg, #1f6feb, #388bfd)',
  },
  {
    key: 'blitz',
    label: 'Blitz',
    mark: 'BZ',
    background: 'linear-gradient(135deg, #db6d28, #f0883e)',
  },
  {
    key: 'lockdown',
    label: 'Lockdown',
    mark: 'LD',
    background: 'linear-gradient(135deg, #238636, #3fb950)',
  },
  {
    key: 'rocket',
    label: 'Rocket',
    mark: 'RK',
    background: 'linear-gradient(135deg, #9e6a03, #d29922)',
  },
  {
    key: 'phantom',
    label: 'Phantom',
    mark: 'PH',
    background: 'linear-gradient(135deg, #8957e5, #bc8cff)',
  },
  {
    key: 'volt',
    label: 'Volt',
    mark: 'VT',
    background: 'linear-gradient(135deg, #0969da, #2f81f7)',
  },
];

export function getAvatarOption(avatarKey) {
  return AVATAR_OPTIONS.find((option) => option.key === avatarKey) || AVATAR_OPTIONS[0];
}

export function getDisplayName(user) {
  if (!user) return '';
  return user.displayName || user.username || '';
}
