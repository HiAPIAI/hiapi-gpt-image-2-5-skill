# Output, recovery, and delivery

The runtime polls `GET /v1/tasks/{taskId}` until success or confirmed terminal failure. It selects an output entry whose `type` is `image`, accepts the documented image URL shape, and downloads it by default into `outputs/`. A successful task with no image output is an error. A download that fails, has a mismatched content type, or fails PNG/JPEG/WebP signature validation is not delivered; resume the same task and retry the download.

`--no-save` deliberately returns the output URL and skips local download. Treat that URL as temporary and perform your own download plus validation before retention or publication. A task ID alone proves acceptance, not a usable image. `--no-wait` proves submission only and can be followed by `--resume-task-id`.

Keep the task ID, idempotency key, selected model, and final local path in internal records. Do not print API keys or private source media. Check file signature and content type, dimensions and aspect ratio, alpha when transparency was requested, and that the result contains the intended subject. Creative review must also check prompt fidelity, edit preservation, text/logo correctness, rights, and policy. Publish only after both technical and creative checks pass.
