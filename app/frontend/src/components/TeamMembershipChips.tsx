/**
 * TeamMembershipChips Component
 *
 * Displays team membership badges on robot cards. Shows which team battle
 * modes a robot participates in (Tag Team, 2v2 League, 3v3 League).
 * No chips displayed if robot has no team membership.
 *
 * Requirements: R9.2, R9.16
 */

interface TeamMembership {
  id: number;
  teamId: number;
  team: {
    id: number;
    teamSize: number;
    teamName: string;
  };
}

interface TeamMembershipChipsProps {
  /** Team battle memberships from the robot's teamBattleMembers relation */
  memberships?: TeamMembership[];
}

interface ChipConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

function getChipConfig(teamSize: number): ChipConfig {
  switch (teamSize) {
    case 2:
      return {
        label: '2v2 League',
        bgColor: 'bg-cyan-500/15',
        textColor: 'text-cyan-300',
        borderColor: 'border-cyan-500/30',
      };
    case 3:
      return {
        label: '3v3 League',
        bgColor: 'bg-teal-500/15',
        textColor: 'text-teal-300',
        borderColor: 'border-teal-500/30',
      };
    default:
      return {
        label: `${teamSize}v${teamSize}`,
        bgColor: 'bg-gray-500/15',
        textColor: 'text-gray-300',
        borderColor: 'border-gray-500/30',
      };
  }
}

function TeamMembershipChips({ memberships }: TeamMembershipChipsProps) {
  if (!memberships || memberships.length === 0) {
    return null;
  }

  // Deduplicate by teamSize (a robot might be on multiple teams of same size,
  // but we show one chip per mode)
  const uniqueSizes = [...new Set(memberships.map((m) => m.team.teamSize))].sort();

  return (
    <div className="flex flex-wrap gap-1.5">
      {uniqueSizes.map((size) => {
        const config = getChipConfig(size);
        return (
          <span
            key={size}
            className={`
              inline-flex items-center
              ${config.bgColor} ${config.textColor} border ${config.borderColor}
              text-xs px-2 py-0.5
              rounded-full font-medium
            `}
          >
            {config.label}
          </span>
        );
      })}
    </div>
  );
}

export default TeamMembershipChips;
