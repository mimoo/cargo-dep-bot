import { Application, Context } from 'probot';
import child_process from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import tmp from 'tmp-promise';

const exec = promisify(child_process.exec);

async function handle_pr(context: Context) {
  context.log("handling PR");
  const base_sha = context.payload.pull_request.base.sha;
  const head_sha = context.payload.pull_request.head.sha;
  const base_lock_params = context.repo({ref: base_sha, path: 'Cargo.lock'});

  context.log(`base sha = ${base_sha}, head sha = ${head_sha}`);
  const head_lock_params = context.repo({ref: head_sha, path: 'Cargo.lock'});
  const base_content_encoded = await context.github.repos.getContents(base_lock_params);
  const base_content = Buffer.from(base_content_encoded.data.content, 'base64').toString()
  const head_content_encoded = await context.github.repos.getContents(head_lock_params);
  const head_content = Buffer.from(head_content_encoded.data.content, 'base64').toString()

  const base_file = await tmp.file();
  const head_file = await tmp.file();

  await fs.writeFile(base_file.path, base_content);
  await fs.writeFile(head_file.path, head_content);

  const { stdout, stderr } = await exec(`cargo lockfile diff ${base_file.path} ${head_file.path}`);
  const text_output = stdout.toString();

  if (text_output.length > 0) {
    const text = '```markdown\n' + text_output + '\n```';
    const body = `This PR made the following dependency changes:\n\n${text}\n`;

    const comment_params = context.repo({number: context.payload.pull_request.number, body: body});
    await context.github.issues.createComment(comment_params);
  }
}

export = (app: Application) => {
  // app.on('pull_request.opened', async (context: Context) => {
  //   context.log("pull request opened");
  //   await handle_pr(context);
  // });

  // app.on('pull_request.synchronize', async (context: Context) => {
  //   context.log("pull request synchronize");
  //   await handle_pr(context);
  // });

  // temp event for testing
  app.on('pull_request.edited', async (context: Context) => {
    context.log("pull request edited");
    await handle_pr(context);
  });
}
