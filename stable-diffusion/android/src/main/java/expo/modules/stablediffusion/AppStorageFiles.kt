package expo.modules.stablediffusion

import android.content.Context
import android.net.Uri
import java.io.File

internal class AppStorageFiles(context: Context) {
  private val filesRoot = context.filesDir.canonicalFile

  fun resolve(uri: String, mustExist: Boolean = false): File {
    val file = File(requireNotNull(Uri.parse(uri).path) { "Invalid file URI" }).canonicalFile
    require(file.path.startsWith(filesRoot.path + File.separator)) { "File must be in app storage" }
    require(!mustExist || file.isFile) { "File not found: ${file.name}" }
    return file
  }
}
