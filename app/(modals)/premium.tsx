import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { triggerHaptic } from "@/helpers/haptics";
import { z } from "zod";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";

// ============================================================================
// ZOD VALIDATION (Payment Details)
// ============================================================================
const PaymentSchema = z.object({
  email: z.string().email("Invalid email address"),
  cardNumber: z.string().regex(/^\d{16}$/, "Invalid card number"),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, "Invalid expiry (MM/YY)"),
  cvv: z.string().regex(/^\d{3,4}$/, "Invalid CVV"),
});

// ============================================================================
// PREMIUM MODAL
// ============================================================================
const PremiumModal = () => {
  const router = useRouter();
  const { startTrial, gracePeriodStatus, daysRemaining } = useGracePeriod();
  const [email, setEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // ============================================================================
  // HANDLE TRIAL START
  // ============================================================================
  const handleStartTrial = async () => {
    triggerHaptic("light");
    
    // Validate input with Zod
    try {
      PaymentSchema.parse({ email, cardNumber, expiry, cvv });
    } catch (error) {
      if (error instanceof z.ZodError) {
        Alert.alert("Validation Error", error.errors[0].message);
      }
      return;
    }
    
    // Process trial
    try {
      setIsProcessing(true);
      
      // In production: Tokenize card with Stripe/Paystack
      const cardToken = `tok_${Math.random().toString(36).substr(2, 10)}`;
      
      // Start trial via engine
      await startTrial(email, cardToken);
      
      triggerHaptic("success");
      Alert.alert(
        "Trial Started!",
        "Enjoy 7 days of ad-free music with premium features!",
        [{ text: "Got it!", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to start trial. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // UI RENDER
  // ============================================================================
  return (
    <SafeAreaView style={[defaultStyles.container, styles.container]}>
      <VerticalSwipeGesture>
        <View style={styles.modalContent}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={moderateScale(28)} color={Colors.text} />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Go Premium</Text>
              <Text style={styles.headerSubtitle}>
                {gracePeriodStatus === 'grace_period' 
                  ? `Start your free trial (${daysRemaining} days left)` 
                  : 'Start your 7-day free trial'}
              </Text>
            </View>
            
            <View style={{ width: 28 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* BENEFITS */}
            <View style={styles.benefitsContainer}>
              <Text style={styles.sectionTitle}>Premium Benefits</Text>
              
              {[
                { icon: "shield-checkmark", title: "Ad-Free Experience", desc: "Zero interruptions" },
                { icon: "cloud-download", title: "Unlimited Downloads", desc: "Download all your music" },
                { icon: "musical-notes", title: "High-Quality Audio", desc: "Crystal clear sound" },
                { icon: "repeat", title: "Background Playback", desc: "Listen while using other apps" },
                { icon: "cloud", title: "Cloud Sync", desc: "Access playlists everywhere" },
              ].map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name={benefit.icon as any} size={moderateScale(20)} color={Colors.primary} />
                  </View>
                  <View style={styles.benefitInfo}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* PAYMENT FORM */}
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>Payment Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isProcessing}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Card Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={Colors.textMuted}
                  value={cardNumber}
                  onChangeText={(text) => {
                    // Auto-format with spaces
                    const formatted = text.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                    setCardNumber(formatted);
                  }}
                  keyboardType="number-pad"
                  maxLength={19}
                  editable={!isProcessing}
                />
              </View>
              
              <View style={styles.rowInputGroup}>
                <View style={styles.rowInput}>
                  <Text style={styles.inputLabel}>Expiry (MM/YY)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="12/25"
                    placeholderTextColor={Colors.textMuted}
                    value={expiry}
                    onChangeText={(text) => {
                      // Auto-format with slash
                      const cleaned = text.replace(/\D/g, '');
                      if (cleaned.length >= 2) {
                        setExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
                      } else {
                        setExpiry(cleaned);
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                    editable={!isProcessing}
                  />
                </View>
                
                <View style={styles.rowInput}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    placeholderTextColor={Colors.textMuted}
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!isProcessing}
                  />
                </View>
              </View>
              
              <Text style={styles.termsText}>
                By starting your trial, you agree to our{" "}
                <Text style={styles.linkText}>Terms of Service</Text> and{" "}
                <Text style={styles.linkText}>Privacy Policy</Text>.{"\n"}
                Your card will be charged $7/month after the 7-day trial. Cancel anytime.
              </Text>
            </View>
          </ScrollView>

          {/* CTA BUTTON */}
          <TouchableOpacity 
            style={[styles.ctaButton, isProcessing && styles.ctaButtonDisabled]} 
            onPress={handleStartTrial}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <ActivityIndicator color="#000" />
                <Text style={styles.ctaButtonText}>Starting Trial...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={moderateScale(20)} color="#000" />
                <Text style={styles.ctaButtonText}>
                  Start 7-Day Free Trial • $7/month after
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </VerticalSwipeGesture>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = ScaledSheet.create({
  container: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    backgroundColor: "#151515",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: "20@s",
    paddingVertical: "16@vs",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerContent: {
    alignItems: "center",
    flex: 1,
    marginLeft: "12@s",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: "22@ms",
    fontWeight: "700",
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: "14@ms",
    marginTop: "4@vs",
    textAlign: "center",
  },
  scrollContent: {
    paddingVertical: "24@vs",
  },
  benefitsContainer: {
    paddingHorizontal: "20@s",
    paddingBottom: "24@vs",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: "20@ms",
    fontWeight: "700",
    marginBottom: "16@vs",
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "16@s",
    paddingVertical: "12@vs",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  benefitIcon: {
    width: "36@s",
    height: "36@s",
    borderRadius: "18@s",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "2@vs",
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitle: {
    color: Colors.text,
    fontSize: "16@ms",
    fontWeight: "600",
    marginBottom: "4@vs",
  },
  benefitDesc: {
    color: Colors.textMuted,
    fontSize: "13@ms",
    lineHeight: "18@ms",
  },
  formContainer: {
    paddingHorizontal: "20@s",
    paddingTop: "24@vs",
  },
  inputGroup: {
    marginBottom: "16@vs",
  },
  rowInputGroup: {
    flexDirection: "row",
    gap: "12@s",
    marginBottom: "16@vs",
  },
  rowInput: {
    flex: 1,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: "14@ms",
    fontWeight: "600",
    marginBottom: "8@vs",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: "12@s",
    padding: "14@s",
    color: Colors.text,
    fontSize: "16@ms",
  },
  termsText: {
    color: Colors.textMuted,
    fontSize: "12@ms",
    lineHeight: "18@ms",
    marginTop: "12@vs",
  },
  linkText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "10@s",
    backgroundColor: Colors.primary,
    paddingVertical: "16@vs",
    marginHorizontal: "20@s",
    marginBottom: "20@vs",
    borderRadius: "16@s",
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaButtonText: {
    color: "#000",
    fontSize: "16@ms",
    fontWeight: "700",
    textAlign: "center",
  },
});

export default PremiumModal;