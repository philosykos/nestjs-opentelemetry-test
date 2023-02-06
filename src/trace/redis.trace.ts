import { Tracer } from '@opentelemetry/api';
import Redis from 'ioredis';
import shimmer from 'shimmer';

const UNTRACKED_COMMANDS = [
  'ping',
  'flushall',
  'flushdb',
  'select',
  'auth',
  'info',
  'quit',
  'slaveof',
  'config',
  'sentinel',
];

function patch(redis: Redis, tracer: Tracer) {
  shimmer.wrap(redis, 'sendCommand', sendCommand);

  function sendCommand(original) {
    return function wrappedSendCommand (commandObj) {
      if (UNTRACKED_COMMANDS.includes(commandObj.command)) {
        original.call(this, commandObj);
      }
    }
  }
}
