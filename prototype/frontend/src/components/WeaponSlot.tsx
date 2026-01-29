interface WeaponInventory {
  id: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    description: string | null;
    baseDamage: number;
  };
}

interface WeaponSlotProps {
  label: string;
  weapon: WeaponInventory | null;
  onEquip: () => void;
  onUnequip: () => void;
  disabled?: boolean;
}

function WeaponSlot({ label, weapon, onEquip, onUnequip, disabled }: WeaponSlotProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'energy':
        return 'text-blue-400';
      case 'ballistic':
        return 'text-orange-400';
      case 'melee':
        return 'text-red-400';
      case 'explosive':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-gray-300">{label}</h4>
        {weapon ? (
          <button
            onClick={onUnequip}
            disabled={disabled}
            className="text-sm text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Unequip
          </button>
        ) : (
          <button
            onClick={onEquip}
            disabled={disabled}
            className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Equip Weapon
          </button>
        )}
      </div>

      {weapon ? (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-white">{weapon.weapon.name}</span>
            <span className={`text-xs uppercase font-semibold ${getTypeColor(weapon.weapon.weaponType)}`}>
              {weapon.weapon.weaponType}
            </span>
          </div>
          {weapon.weapon.description && (
            <p className="text-sm text-gray-400 mb-2">{weapon.weapon.description}</p>
          )}
          <div className="text-sm text-gray-400">
            Base Damage: <span className="text-white font-semibold">{weapon.weapon.baseDamage}</span>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-sm italic">No weapon equipped</div>
      )}
    </div>
  );
}

export default WeaponSlot;
