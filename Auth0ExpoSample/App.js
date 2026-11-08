import React from 'react';
import {Auth0Provider, useAuth0} from 'react-native-auth0';
import {
  StyleSheet,
  Text,
  View,
  Button,
  Image,
  ActivityIndicator,
} from 'react-native';

function HomeScreen() {
  const {authorize, clearSession, user, isLoading} = useAuth0();

  const handleLogin = async () => {
    try {
      await authorize({customScheme: 'auth0sample', scope: 'openid profile email'});
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  const handleLogout = async () => {
    try {
      await clearSession({customScheme: 'auth0sample'});
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auth0 Expo Sample</Text>

      {user ? (
        <View style={styles.profileContainer}>
          {user.picture && (
            <Image source={{uri: user.picture}} style={styles.avatar} />
          )}
          <Text style={styles.welcomeText}>Welcome, {user.name}!</Text>
          <Text style={styles.emailText}>{user.email}</Text>
          <View style={styles.buttonContainer}>
            <Button title="Log Out" onPress={handleLogout} color="#dc3545" />
          </View>
        </View>
      ) : (
        <View style={styles.loginContainer}>
          <Text style={styles.subtitle}>
            Tap the button below to log in
          </Text>
          <View style={styles.buttonContainer}>
            <Button title="Log In" onPress={handleLogin} color="#0066cc" />
          </View>
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <Auth0Provider domain="dev-axj0j24qp5ihpd8r.us.auth0.com" clientId="t8h66i3ZJO6KuxDK2Y2dNZuSg2fqj7yw">
      <HomeScreen />
    </Auth0Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  profileContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  emailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  loginContainer: {
    alignItems: 'center',
  },
  buttonContainer: {
    width: 200,
    marginTop: 10,
  },
});