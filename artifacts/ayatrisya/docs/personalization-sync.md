# Personalization cloud sync setup

Cloud preference sync uses the Firebase project already configured for Ayatrisya Authentication. It does not create a Firebase project or enable Firestore automatically.

## One-time Firebase setup

1. In the existing Firebase project, enable Cloud Firestore in Native mode.
2. Open Firestore Database → Rules in the Firebase Console.
3. Publish the rules from `artifacts/ayatrisya/firestore.rules`.

The rules allow each signed-in user to read and write only their own personalization document. The app stores the document at `users/{uid}/privateSettings/personalization`.

## Turn sync on

1. Sign in to Ayatrisya.
2. Open Settings → Personalization.
3. On the first device, select **Upload this device & enable**.
4. On another device signed into the same account, select **Restore cloud settings & enable**.
5. After that, changes sync while both devices have sync enabled and can reach Firestore.

This sync includes response style, the personal summary, and built-in wallpaper selection. It does not sync chats, projects, files, or custom wallpaper image bytes. Turning sync off stops future syncs but leaves the cloud document in place.
