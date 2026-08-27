  // ---- Google Drive sync ----
  const CLIENT_ID = '185876513289-u805efh6lsqicckan5oa7a93v8hh0jia.apps.googleusercontent.com';
  // drive.readonly: list/download epub files from your folder
  // drive.file: create/update a small progress file this app owns
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
  const PROGRESS_FILENAME = 'reader-progress.json';

  let accessToken = null;
  let tokenClient = null;
  let driveProgressFileId = localStorage.getItem('reader_drive_progress_file_id') || null;

  window.addEventListener('load', function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: function (resp) {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          setDriveStatus('online', 'Connected to Drive');
          syncWithDrive();
        } else if (!silentAttempt) {
          setDriveStatus('offline', 'Sign-in failed');
        }
        silentAttempt = false;
      }
    });
    // Try a silent (no popup) reconnect on page load if we've synced before.
    // Delayed slightly so it doesn't visually compete with the app's own
    // initial render — the brief flash some browsers show for this silent
    // flow is otherwise easy to mistake for part of page load.
    if (localStorage.getItem('reader_drive_folder_id')) {
      setTimeout(function () {
        silentAttempt = true;
        tokenClient.requestAccessToken({ prompt: 'none' });
      }, 1200);
    }
  });
  var silentAttempt = false;

  function setDriveStatus(kind, text) {
    gdriveDot.className = 'status-dot ' + kind;
    gdriveStatusText.textContent = text;
    gdriveConnect.textContent = kind === 'online' ? '✓ Connected' : 'Connect';
  }

  function driveSignIn() {
    if (!tokenClient) return;
    setDriveStatus('syncing', 'Connecting…');
    // prompt:'' lets Google decide: if you've already granted access before
    // (and your Google session is still valid), this reconnects with little
    // or no visible prompt. Only shows the full consent screen if you've
    // never granted access, or revoked it.
    tokenClient.requestAccessToken({ prompt: '' });
  }

  function driveFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + accessToken });
    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        // token expired mid-session — ask the user to reconnect
        accessToken = null;
        setDriveStatus('offline', 'Disconnected — reconnect');
        throw new Error('Drive session expired, please click Connect again.');
      }
      if (!res.ok) throw new Error('Drive request failed (' + res.status + ')');
      return res;
    });
  }

  function listDriveEpubs(folderId) {
    var q = encodeURIComponent("'" + folderId + "' in parents and mimeType='application/epub+zip' and trashed=false");
    var url = 'https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name,modifiedTime)&pageSize=200';
    return driveFetch(url).then(function (res) { return res.json(); }).then(function (data) { return data.files || []; });
  }

  function downloadDriveFile(fileId) {
    var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';
    return driveFetch(url).then(function (res) { return res.arrayBuffer(); });
  }

  // ---- Progress file (small JSON, lives in the same Drive folder) ----
  function findOrCreateProgressFile(folderId) {
    if (driveProgressFileId) return Promise.resolve(driveProgressFileId);
    var q = encodeURIComponent("'" + folderId + "' in parents and name='" + PROGRESS_FILENAME + "' and trashed=false");
    var url = 'https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)';
    return driveFetch(url).then(function (res) { return res.json(); }).then(function (data) {
      if (data.files && data.files.length) {
        driveProgressFileId = data.files[0].id;
        localStorage.setItem('reader_drive_progress_file_id', driveProgressFileId);
        return driveProgressFileId;
      }
      // create it empty
      var metadata = { name: PROGRESS_FILENAME, parents: [folderId], mimeType: 'application/json' };
      var boundary = 'readerbound';
      var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n{}\r\n--' + boundary + '--';
      return driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: body
      }).then(function (res) { return res.json(); }).then(function (created) {
        driveProgressFileId = created.id;
        localStorage.setItem('reader_drive_progress_file_id', driveProgressFileId);
        return driveProgressFileId;
      });
    });
  }

  function downloadProgressFile(folderId) {
    return findOrCreateProgressFile(folderId).then(function (fileId) {
      return driveFetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media')
        .then(function (res) { return res.text(); })
        .then(function (text) { try { return JSON.parse(text || '{}'); } catch (e) { return {}; } });
    });
  }

  function uploadProgressFile(folderId, progressObj) {
    return findOrCreateProgressFile(folderId).then(function (fileId) {
      return driveFetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressObj)
      });
    });
  }

  // Merge local library progress with the Drive progress file, newer lastOpened wins,
  // then push the merged result back up. Keyed by driveId (stable across devices).
  function mergeAndSyncProgress(folderId) {
    return downloadProgressFile(folderId).then(function (remote) {
      var list = loadLibraryList();
      var changedLocal = false;
      list.forEach(function (book) {
        if (!book.driveId) return;
        var r = remote[book.driveId];
        if (r && (r.lastOpened || 0) > (book.lastOpened || 0)) {
          book.progress = r.progress;
          book.status = r.status;
          book.lastOpened = r.lastOpened;
          changedLocal = true;
        }
        remote[book.driveId] = {
          progress: book.progress || 0,
          status: book.status || 'unread',
          lastOpened: book.lastOpened || 0
        };
      });
      if (changedLocal) saveLibraryList(list);
      return uploadProgressFile(folderId, remote).then(function () { return changedLocal; });
    });
  }

  // ---- Bringing new/updated epubs in from Drive ----
  function syncWithDrive() {
    var folderId = (gdriveFolderId.value || '').trim();
    if (!folderId) { showToast('Add your Drive folder ID first.'); return; }
    if (!accessToken) { driveSignIn(); return; }
    if (typeof JSZip === 'undefined') { showToast('EPUB support failed to load — check your connection.'); return; }

    setDriveStatus('syncing', 'Syncing…');
    listDriveEpubs(folderId).then(function (files) {
      var list = loadLibraryList();
      var byDriveId = {};
      list.forEach(function (b) { if (b.driveId) byDriveId[b.driveId] = b; });

      var toFetch = files.filter(function (f) {
        var existing = byDriveId[f.id];
        return !existing || existing.driveModifiedTime !== f.modifiedTime;
      });

      var added = 0, updated = 0, failed = 0;
      return toFetch.reduce(function (chain, f) {
        return chain.then(function () {
          showToast('Syncing ' + f.name + '…');
          return downloadDriveFile(f.id).then(function (buf) {
            return parseEpub(buf, f.name).then(function (book) {
              book.driveId = f.id;
              book.driveModifiedTime = f.modifiedTime;
              var freshList = loadLibraryList();
              var idx = freshList.findIndex(function (b) { return b.driveId === f.id; });
              if (idx >= 0) {
                // keep local reading progress, refresh content/cover only
                book.progress = freshList[idx].progress;
                book.status = freshList[idx].status;
                book.lastOpened = freshList[idx].lastOpened;
                book.id = freshList[idx].id;
                freshList[idx] = book;
                updated++;
              } else {
                freshList.push(book);
                added++;
              }
              if (!saveLibraryList(freshList)) { failed++; showToast('"' + book.title + '" is too large to save locally.'); }
              document.body.classList.contains('library-open') && renderLibrary();
            });
          }).catch(function (err) {
            console.error(err); failed++;
            showToast('Could not sync ' + f.name + ' — ' + (err && err.message ? err.message : 'unknown error'));
          });
        });
      }, Promise.resolve()).then(function () {
        return mergeAndSyncProgress(folderId);
      }).then(function () {
        setDriveStatus('online', 'Connected to Drive');
        document.body.classList.contains('library-open') && renderLibrary();
        if (added || updated) {
          showToast('Synced: ' + added + ' added, ' + updated + ' updated.');
        } else {
          showToast('Drive library is up to date.');
        }
      });
    }).catch(function (err) {
      console.error(err);
      setDriveStatus('offline', 'Sync failed');
      showToast(err && err.message ? err.message : 'Drive sync failed.');
    });
  }
