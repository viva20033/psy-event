import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CHAT_RULES_KEY, CHAT_RULES_TEXT } from '@/config/chat';

interface ChatRulesGateProps {
  onAccept: () => void;
}

export function ChatRulesGate({ onAccept }: ChatRulesGateProps) {
  function accept() {
    localStorage.setItem(CHAT_RULES_KEY, '1');
    onAccept();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <Card className="w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-primary-900">Болталка интенсива</h2>
        <p className="text-sm text-slate-600">
          Одно общее пространство для всех участников — альтернатива мессенджерам, которые
          неудобны без VPN.
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
          {CHAT_RULES_TEXT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Button fullWidth onClick={accept}>
          Понятно, войти в болталку
        </Button>
      </Card>
    </div>
  );
}

export function hasAcceptedChatRules(): boolean {
  return localStorage.getItem(CHAT_RULES_KEY) === '1';
}
