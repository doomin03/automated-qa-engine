import 'dart:convert';
import 'dart:io';
import 'dart:async';
Future<void> main(List<String> args) async {
  final child = await Process.start('node', ['scripts/spikes/runner.mjs']);
  final errors = child.stderr.transform(utf8.decoder).join();
  final lines = StreamIterator(child.stdout.transform(utf8.decoder).transform(const LineSplitter()));
  final observations = <String>[];
  try {
    if (!await lines.moveNext().timeout(const Duration(seconds: 30))) throw StateError('No ready event');
    if (jsonDecode(lines.current)['type'] != 'ready') throw StateError('Invalid ready');
    for (final expected in ['QA', 'WRONG']) {
      child.stdin.writeln(jsonEncode({'type': 'run', 'expected': expected}));
      await child.stdin.flush();
      if (!await lines.moveNext().timeout(const Duration(seconds: 10))) throw StateError('Missing result');
      observations.add(jsonDecode(lines.current)['outcome'] as String);
    }
    child.stdin.writeln(jsonEncode({'type': 'shutdown'}));
    await child.stdin.close();
    final exit = await child.exitCode.timeout(const Duration(seconds: 10));
    if (exit != 0 || observations.join(',') != 'passed,failed') throw StateError('Unexpected result');
    print(jsonEncode({'ipc': 'passed', 'outcomes': observations, 'shutdownExit': exit, 'pid': child.pid}));
  } finally {
    if (Platform.isWindows) {
      await Process.run('taskkill', ['/PID', '${child.pid}', '/T', '/F']);
    } else {
      child.kill();
    }
    await lines.cancel();
    final stderrText = await errors;
    if (stderrText.isNotEmpty) stderr.write(stderrText);
  }
}

