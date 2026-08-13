import { useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { generateImage } from 'stable-diffusion';

export default function HomeScreen() {
  const [prompt, setPrompt] = useState('A cat in a space suit');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setImageUri(null);

    try {
      const uri = await generateImage(prompt);
      if (uri.startsWith('Error')) {
        setErrorMsg(uri);
      } else {
        setImageUri(uri);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Pocket Canvas PoC
        </ThemedText>

        <ThemedText type="default">Model: SD 1.5 Q4_K + LCM-LoRA</ThemedText>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Enter prompt here..."
            placeholderTextColor="#888"
          />
        </View>

        <Button
          title={isGenerating ? "Generating..." : "Generate Image"}
          onPress={handleGenerate}
          disabled={isGenerating || !prompt}
        />

        <View style={styles.resultContainer}>
          {isGenerating && <ActivityIndicator size="large" color="#0000ff" />}

          {errorMsg && (
            <ThemedText type="default" style={styles.errorText}>
              {errorMsg}
            </ThemedText>
          )}

          {imageUri && !isGenerating && (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
    alignItems: 'center',
  },
  title: {
    marginBottom: Spacing.two,
  },
  inputContainer: {
    width: '100%',
    marginVertical: Spacing.four,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: Spacing.three,
    backgroundColor: '#fff',
    color: '#000',
  },
  resultContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 400,
    backgroundColor: '#eee',
    borderRadius: 8,
  },
});
